/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../util/vs/base/common/lifecycle';
import { Event, Emitter } from '../../../util/vs/base/common/event';

export interface IPerformanceMetric {
	name: string;
	value: number;
	timestamp: number;
	category: MetricCategory;
	tags?: Record<string, string>;
}

export enum MetricCategory {
	Memory = 'memory',
	CPU = 'cpu',
	Network = 'network',
	Cache = 'cache',
	UI = 'ui',
	AI = 'ai'
}

export interface IPerformanceThreshold {
	metric: string;
	warning: number;
	critical: number;
}

export interface IPerformanceAlert {
	metric: string;
	level: 'warning' | 'critical';
	value: number;
	threshold: number;
	timestamp: number;
	suggestion?: string;
}

export interface IPerformanceReport {
	timestamp: number;
	metrics: IPerformanceMetric[];
	alerts: IPerformanceAlert[];
	recommendations: string[];
	overallScore: number;
}

export interface IPerformanceMonitorService {
	recordMetric(name: string, value: number, category: MetricCategory, tags?: Record<string, string>): void;
	startTimer(name: string, category: MetricCategory): IPerformanceTimer;
	getMetrics(category?: MetricCategory, timeRange?: number): IPerformanceMetric[];
	generateReport(): IPerformanceReport;
	setThreshold(metric: string, warning: number, critical: number): void;
	onAlert: Event<IPerformanceAlert>;
	onReportGenerated: Event<IPerformanceReport>;
}

export interface IPerformanceTimer {
	stop(tags?: Record<string, string>): number;
}

/**
 * Advanced performance monitoring system with:
 * - Real-time metric collection
 * - Intelligent alerting
 * - Performance bottleneck detection
 * - Optimization recommendations
 * - Historical trend analysis
 */
export class PerformanceMonitorService extends Disposable implements IPerformanceMonitorService {
	private readonly metrics: IPerformanceMetric[] = [];
	private readonly thresholds = new Map<string, IPerformanceThreshold>();
	private readonly _onAlert = new Emitter<IPerformanceAlert>();
	private readonly _onReportGenerated = new Emitter<IPerformanceReport>();
	
	readonly onAlert = this._onAlert.event;
	readonly onReportGenerated = this._onReportGenerated.event;

	private reportInterval: NodeJS.Timeout;
	private readonly maxMetrics = 10000; // Keep last 10k metrics
	
	constructor() {
		super();
		
		// Set default thresholds
		this.setDefaultThresholds();
		
		// Generate reports every 5 minutes
		this.reportInterval = setInterval(() => {
			const report = this.generateReport();
			this._onReportGenerated.fire(report);
		}, 5 * 60 * 1000);
		
		this._register({ dispose: () => clearInterval(this.reportInterval) });
		
		// Start system monitoring
		this.startSystemMonitoring();
	}

	recordMetric(name: string, value: number, category: MetricCategory, tags?: Record<string, string>): void {
		const metric: IPerformanceMetric = {
			name,
			value,
			timestamp: Date.now(),
			category,
			tags
		};

		this.metrics.push(metric);
		
		// Trim metrics if we have too many
		if (this.metrics.length > this.maxMetrics) {
			this.metrics.splice(0, this.metrics.length - this.maxMetrics);
		}

		// Check thresholds
		this.checkThreshold(metric);
	}

	startTimer(name: string, category: MetricCategory): IPerformanceTimer {
		const startTime = performance.now();
		
		return {
			stop: (tags?: Record<string, string>) => {
				const duration = performance.now() - startTime;
				this.recordMetric(name, duration, category, tags);
				return duration;
			}
		};
	}

	getMetrics(category?: MetricCategory, timeRange?: number): IPerformanceMetric[] {
		let filtered = this.metrics;
		
		if (category) {
			filtered = filtered.filter(m => m.category === category);
		}
		
		if (timeRange) {
			const cutoff = Date.now() - timeRange;
			filtered = filtered.filter(m => m.timestamp >= cutoff);
		}
		
		return filtered;
	}

	generateReport(): IPerformanceReport {
		const now = Date.now();
		const recentMetrics = this.getMetrics(undefined, 5 * 60 * 1000); // Last 5 minutes
		
		const alerts = this.generateAlerts(recentMetrics);
		const recommendations = this.generateRecommendations(recentMetrics, alerts);
		const overallScore = this.calculateOverallScore(recentMetrics, alerts);
		
		return {
			timestamp: now,
			metrics: recentMetrics,
			alerts,
			recommendations,
			overallScore
		};
	}

	setThreshold(metric: string, warning: number, critical: number): void {
		this.thresholds.set(metric, { metric, warning, critical });
	}

	private setDefaultThresholds(): void {
		// Memory thresholds (MB)
		this.setThreshold('memory.heap.used', 100, 200);
		this.setThreshold('memory.heap.total', 200, 400);
		
		// CPU thresholds (%)
		this.setThreshold('cpu.usage', 70, 90);
		
		// Response time thresholds (ms)
		this.setThreshold('ai.completion.time', 2000, 5000);
		this.setThreshold('chat.response.time', 3000, 8000);
		this.setThreshold('ui.render.time', 16, 33); // 60fps, 30fps
		
		// Cache thresholds
		this.setThreshold('cache.hit.rate', 0.7, 0.5); // Lower is worse for hit rate
		this.setThreshold('cache.memory.usage', 80, 95); // Percentage
	}

	private checkThreshold(metric: IPerformanceMetric): void {
		const threshold = this.thresholds.get(metric.name);
		if (!threshold) return;

		let alert: IPerformanceAlert | undefined;

		if (metric.value >= threshold.critical) {
			alert = {
				metric: metric.name,
				level: 'critical',
				value: metric.value,
				threshold: threshold.critical,
				timestamp: metric.timestamp,
				suggestion: this.getSuggestion(metric.name, 'critical')
			};
		} else if (metric.value >= threshold.warning) {
			alert = {
				metric: metric.name,
				level: 'warning',
				value: metric.value,
				threshold: threshold.warning,
				timestamp: metric.timestamp,
				suggestion: this.getSuggestion(metric.name, 'warning')
			};
		}

		if (alert) {
			this._onAlert.fire(alert);
		}
	}

	private getSuggestion(metricName: string, level: string): string {
		const suggestions: Record<string, Record<string, string>> = {
			'memory.heap.used': {
				warning: 'Consider clearing unused caches or reducing memory usage',
				critical: 'Memory usage is critically high. Clear caches and restart if necessary'
			},
			'ai.completion.time': {
				warning: 'AI completion is slow. Check network connection and cache status',
				critical: 'AI completion is very slow. Consider reducing request complexity'
			},
			'ui.render.time': {
				warning: 'UI rendering is slow. Consider reducing visual complexity',
				critical: 'UI rendering is very slow. Disable animations or reduce data'
			},
			'cache.hit.rate': {
				warning: 'Cache hit rate is low. Consider warming up cache or adjusting strategy',
				critical: 'Cache hit rate is very low. Review caching implementation'
			}
		};

		return suggestions[metricName]?.[level] || 'Consider investigating this metric';
	}

	private generateAlerts(metrics: IPerformanceMetric[]): IPerformanceAlert[] {
		const alerts: IPerformanceAlert[] = [];
		const metricGroups = this.groupMetricsByName(metrics);

		for (const [name, groupMetrics] of metricGroups) {
			const threshold = this.thresholds.get(name);
			if (!threshold || groupMetrics.length === 0) continue;

			const avgValue = groupMetrics.reduce((sum, m) => sum + m.value, 0) / groupMetrics.length;
			const latestMetric = groupMetrics[groupMetrics.length - 1];

			if (avgValue >= threshold.critical) {
				alerts.push({
					metric: name,
					level: 'critical',
					value: avgValue,
					threshold: threshold.critical,
					timestamp: latestMetric.timestamp,
					suggestion: this.getSuggestion(name, 'critical')
				});
			} else if (avgValue >= threshold.warning) {
				alerts.push({
					metric: name,
					level: 'warning',
					value: avgValue,
					threshold: threshold.warning,
					timestamp: latestMetric.timestamp,
					suggestion: this.getSuggestion(name, 'warning')
				});
			}
		}

		return alerts;
	}

	private generateRecommendations(metrics: IPerformanceMetric[], alerts: IPerformanceAlert[]): string[] {
		const recommendations: string[] = [];

		// Analyze patterns and generate recommendations
		if (alerts.some(a => a.metric.includes('memory'))) {
			recommendations.push('Consider implementing more aggressive memory management');
		}

		if (alerts.some(a => a.metric.includes('ai') && a.level === 'critical')) {
			recommendations.push('AI operations are slow - consider caching responses or reducing complexity');
		}

		if (alerts.some(a => a.metric.includes('ui'))) {
			recommendations.push('UI performance issues detected - consider virtualization or lazy loading');
		}

		// Check for trends
		const memoryMetrics = metrics.filter(m => m.name.includes('memory')).slice(-10);
		if (memoryMetrics.length >= 5 && this.isIncreasingTrend(memoryMetrics.map(m => m.value))) {
			recommendations.push('Memory usage is trending upward - investigate potential memory leaks');
		}

		return recommendations;
	}

	private calculateOverallScore(metrics: IPerformanceMetric[], alerts: IPerformanceAlert[]): number {
		let score = 100;

		// Deduct points for alerts
		for (const alert of alerts) {
			if (alert.level === 'critical') {
				score -= 20;
			} else if (alert.level === 'warning') {
				score -= 10;
			}
		}

		// Bonus for good cache performance
		const cacheHitRate = metrics.find(m => m.name === 'cache.hit.rate');
		if (cacheHitRate && cacheHitRate.value > 0.8) {
			score += 5;
		}

		return Math.max(0, Math.min(100, score));
	}

	private groupMetricsByName(metrics: IPerformanceMetric[]): Map<string, IPerformanceMetric[]> {
		const groups = new Map<string, IPerformanceMetric[]>();
		
		for (const metric of metrics) {
			if (!groups.has(metric.name)) {
				groups.set(metric.name, []);
			}
			groups.get(metric.name)!.push(metric);
		}
		
		return groups;
	}

	private isIncreasingTrend(values: number[]): boolean {
		if (values.length < 3) return false;
		
		let increases = 0;
		for (let i = 1; i < values.length; i++) {
			if (values[i] > values[i - 1]) {
				increases++;
			}
		}
		
		return increases / (values.length - 1) > 0.6; // 60% of values are increasing
	}

	private startSystemMonitoring(): void {
		// Monitor system metrics every 30 seconds
		const monitoringInterval = setInterval(() => {
			try {
				// Memory monitoring
				if (typeof process !== 'undefined' && process.memoryUsage) {
					const memory = process.memoryUsage();
					this.recordMetric('memory.heap.used', memory.heapUsed / 1024 / 1024, MetricCategory.Memory);
					this.recordMetric('memory.heap.total', memory.heapTotal / 1024 / 1024, MetricCategory.Memory);
					this.recordMetric('memory.rss', memory.rss / 1024 / 1024, MetricCategory.Memory);
				}

				// CPU monitoring (simplified)
				const cpuUsage = this.getCPUUsage();
				if (cpuUsage !== null) {
					this.recordMetric('cpu.usage', cpuUsage, MetricCategory.CPU);
				}

			} catch (error) {
				// Silently handle monitoring errors
			}
		}, 30000);

		this._register({ dispose: () => clearInterval(monitoringInterval) });
	}

	private getCPUUsage(): number | null {
		try {
			if (typeof process !== 'undefined' && process.cpuUsage) {
				const usage = process.cpuUsage();
				return (usage.user + usage.system) / 1000000; // Convert to milliseconds
			}
		} catch {
			// Fallback or unsupported environment
		}
		return null;
	}
}