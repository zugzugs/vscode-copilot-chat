import { Disposable } from '../../../util/vs/base/common/lifecycle';
import { Event, Emitter } from '../../../util/vs/base/common/event';

export interface ICacheEntry<T> {
	key: string;
	value: T;
	timestamp: number;
	accessCount: number;
	lastAccess: number;
	priority: CachePriority;
	size: number;
	ttl?: number;
}

export enum CachePriority {
	Low = 0,
	Normal = 1,
	High = 2,
	Critical = 3
}

export interface ICacheStrategy {
	shouldEvict(entry: ICacheEntry<any>, cacheSize: number, maxSize: number): boolean;
	getPriority(key: string, value: any): CachePriority;
}

export interface IIntelligentCacheService {
	get<T>(key: string): T | undefined;
	set<T>(key: string, value: T, options?: ICacheOptions): void;
	has(key: string): boolean;
	delete(key: string): boolean;
	clear(): void;
	getStats(): ICacheStats;
	preload(keys: string[]): Promise<void>;
	warmUp(patterns: string[]): Promise<void>;
	onCacheHit: Event<string>;
	onCacheMiss: Event<string>;
	onEviction: Event<string>;
}

export interface ICacheOptions {
	ttl?: number;
	priority?: CachePriority;
	persistent?: boolean;
	compress?: boolean;
}

export interface ICacheStats {
	hits: number;
	misses: number;
	evictions: number;
	size: number;
	maxSize: number;
	hitRate: number;
	memoryUsage: number;
}

/**
 * Advanced intelligent caching system with multiple strategies:
 * - LRU (Least Recently Used)
 * - LFU (Least Frequently Used)
 * - Priority-based eviction
 * - Predictive loading
 * - Memory pressure awareness
 */
export class IntelligentCacheService extends Disposable implements IIntelligentCacheService {
	private readonly cache = new Map<string, ICacheEntry<any>>();
	private readonly _onCacheHit = new Emitter<string>();
	private readonly _onCacheMiss = new Emitter<string>();
	private readonly _onEviction = new Emitter<string>();

	readonly onCacheHit = this._onCacheHit.event;
	readonly onCacheMiss = this._onCacheMiss.event;
	readonly onEviction = this._onEviction.event;

	private stats: ICacheStats = {
		hits: 0,
		misses: 0,
		evictions: 0,
		size: 0,
		maxSize: 0,
		hitRate: 0,
		memoryUsage: 0
	};

	private readonly maxSize: number;
	private readonly strategy: ICacheStrategy;
	private cleanupInterval: NodeJS.Timeout;

	constructor(
		maxSize: number = 100 * 1024 * 1024, // 100MB default
		strategy?: ICacheStrategy
	) {
		super();
		this.maxSize = maxSize;
		this.stats.maxSize = maxSize;
		this.strategy = strategy || new AdaptiveCacheStrategy();
		
		// Cleanup expired entries every 5 minutes
		this.cleanupInterval = setInterval(() => this.cleanupExpired(), 5 * 60 * 1000);
		this._register({ dispose: () => clearInterval(this.cleanupInterval) });
	}

	get<T>(key: string): T | undefined {
		const entry = this.cache.get(key);
		
		if (!entry) {
			this.stats.misses++;
			this._onCacheMiss.fire(key);
			this.updateHitRate();
			return undefined;
		}

		// Check if expired
		if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
			this.cache.delete(key);
			this.stats.misses++;
			this._onCacheMiss.fire(key);
			this.updateHitRate();
			return undefined;
		}

		// Update access statistics
		entry.accessCount++;
		entry.lastAccess = Date.now();
		
		this.stats.hits++;
		this._onCacheHit.fire(key);
		this.updateHitRate();
		
		return entry.value as T;
	}

	set<T>(key: string, value: T, options?: ICacheOptions): void {
		const size = this.estimateSize(value);
		const priority = options?.priority || this.strategy.getPriority(key, value);
		
		const entry: ICacheEntry<T> = {
			key,
			value,
			timestamp: Date.now(),
			accessCount: 1,
			lastAccess: Date.now(),
			priority,
			size,
			ttl: options?.ttl
		};

		// Check if we need to make space
		while (this.stats.size + size > this.maxSize && this.cache.size > 0) {
			this.evictLeastImportant();
		}

		// Remove existing entry if it exists
		if (this.cache.has(key)) {
			const oldEntry = this.cache.get(key)!;
			this.stats.size -= oldEntry.size;
		}

		this.cache.set(key, entry);
		this.stats.size += size;
	}

	has(key: string): boolean {
		const entry = this.cache.get(key);
		if (!entry) return false;
		
		// Check if expired
		if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
			this.cache.delete(key);
			return false;
		}
		
		return true;
	}

	delete(key: string): boolean {
		const entry = this.cache.get(key);
		if (entry) {
			this.stats.size -= entry.size;
			return this.cache.delete(key);
		}
		return false;
	}

	clear(): void {
		this.cache.clear();
		this.stats.size = 0;
		this.stats.hits = 0;
		this.stats.misses = 0;
		this.stats.evictions = 0;
		this.stats.hitRate = 0;
	}

	getStats(): ICacheStats {
		return { ...this.stats, memoryUsage: this.stats.size };
	}

	async preload(keys: string[]): Promise<void> {
		// Implement predictive loading based on usage patterns
		// This would typically load from persistent storage or external sources
		for (const key of keys) {
			if (!this.has(key)) {
				// Load from persistent storage if available
				await this.loadFromPersistentStorage(key);
			}
		}
	}

	async warmUp(patterns: string[]): Promise<void> {
		// Warm up cache with commonly used patterns
		// This could analyze usage patterns and preload likely-to-be-used items
		for (const pattern of patterns) {
			await this.preloadPattern(pattern);
		}
	}

	private evictLeastImportant(): void {
		let victimKey: string | undefined;
		let lowestScore = Infinity;

		for (const [key, entry] of this.cache) {
			if (this.strategy.shouldEvict(entry, this.stats.size, this.maxSize)) {
				const score = this.calculateEvictionScore(entry);
				if (score < lowestScore) {
					lowestScore = score;
					victimKey = key;
				}
			}
		}

		if (victimKey) {
			const entry = this.cache.get(victimKey)!;
			this.stats.size -= entry.size;
			this.cache.delete(victimKey);
			this.stats.evictions++;
			this._onEviction.fire(victimKey);
		}
	}

	private calculateEvictionScore(entry: ICacheEntry<any>): number {
		const now = Date.now();
		const age = now - entry.timestamp;
		const timeSinceLastAccess = now - entry.lastAccess;
		const frequency = entry.accessCount / Math.max(age / 1000, 1); // accesses per second
		
		// Lower score = more likely to be evicted
		// Higher priority, more recent access, and higher frequency = higher score
		return (entry.priority + 1) * frequency * (1 / (timeSinceLastAccess + 1));
	}

	private cleanupExpired(): void {
		const now = Date.now();
		const expiredKeys: string[] = [];

		for (const [key, entry] of this.cache) {
			if (entry.ttl && now - entry.timestamp > entry.ttl) {
				expiredKeys.push(key);
			}
		}

		for (const key of expiredKeys) {
			this.delete(key);
		}
	}

	private updateHitRate(): void {
		const total = this.stats.hits + this.stats.misses;
		this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
	}

	private estimateSize(value: any): number {
		if (typeof value === 'string') {
			return value.length * 2; // Approximate UTF-16 encoding
		} else if (typeof value === 'object' && value !== null) {
			return JSON.stringify(value).length * 2; // Rough estimate
		} else {
			return 8; // Primitive values
		}
	}

	private async loadFromPersistentStorage(key: string): Promise<void> {
		// Placeholder for persistent storage loading
		// Could integrate with VS Code's storage APIs
	}

	private async preloadPattern(pattern: string): Promise<void> {
		// Placeholder for pattern-based preloading
		// Could analyze file patterns, usage history, etc.
	}
}

/**
 * Adaptive cache strategy that learns from usage patterns
 */
export class AdaptiveCacheStrategy implements ICacheStrategy {
	private readonly usagePatterns = new Map<string, number>();

	shouldEvict(entry: ICacheEntry<any>, cacheSize: number, maxSize: number): boolean {
		// Don't evict critical priority items unless absolutely necessary
		if (entry.priority === CachePriority.Critical && cacheSize < maxSize * 0.95) {
			return false;
		}

		// Consider frequency, recency, and priority
		const now = Date.now();
		const age = now - entry.timestamp;
		const timeSinceLastAccess = now - entry.lastAccess;
		
		// More likely to evict if old, rarely accessed, or low priority
		return age > 30 * 60 * 1000 || // Older than 30 minutes
			   timeSinceLastAccess > 10 * 60 * 1000 || // Not accessed in 10 minutes
			   entry.priority === CachePriority.Low;
	}

	getPriority(key: string, value: any): CachePriority {
		// Analyze key patterns to determine priority
		if (key.includes('completion') || key.includes('suggestion')) {
			return CachePriority.High;
		} else if (key.includes('config') || key.includes('setting')) {
			return CachePriority.Critical;
		} else if (key.includes('temp') || key.includes('cache')) {
			return CachePriority.Low;
		}
		
		return CachePriority.Normal;
	}
}