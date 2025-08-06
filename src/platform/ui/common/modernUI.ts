import { Disposable } from '../../../util/vs/base/common/lifecycle';
import { Event, Emitter } from '../../../util/vs/base/common/event';

export interface IUITheme {
	id: string;
	name: string;
	colors: IColorPalette;
	typography: ITypography;
	animations: IAnimationSettings;
	accessibility: IAccessibilitySettings;
}

export interface IColorPalette {
	primary: string;
	secondary: string;
	accent: string;
	background: string;
	surface: string;
	text: string;
	textSecondary: string;
	border: string;
	success: string;
	warning: string;
	error: string;
	info: string;
	gradient?: string;
}

export interface ITypography {
	fontFamily: string;
	fontSize: {
		xs: string;
		sm: string;
		base: string;
		lg: string;
		xl: string;
		'2xl': string;
		'3xl': string;
	};
	fontWeight: {
		normal: number;
		medium: number;
		semibold: number;
		bold: number;
	};
	lineHeight: {
		tight: number;
		normal: number;
		relaxed: number;
	};
}

export interface IAnimationSettings {
	enabled: boolean;
	duration: {
		fast: number;
		normal: number;
		slow: number;
	};
	easing: {
		ease: string;
		easeIn: string;
		easeOut: string;
		easeInOut: string;
		bounce: string;
	};
	reducedMotion: boolean;
}

export interface IAccessibilitySettings {
	highContrast: boolean;
	focusVisible: boolean;
	screenReaderOptimized: boolean;
	keyboardNavigation: boolean;
	fontSize: 'small' | 'medium' | 'large' | 'xl';
}

export interface IUIComponent {
	id: string;
	type: ComponentType;
	props: Record<string, any>;
	children?: IUIComponent[];
	animations?: IComponentAnimation[];
	accessibility?: IComponentAccessibility;
}

export enum ComponentType {
	Button = 'button',
	Card = 'card',
	Modal = 'modal',
	Toast = 'toast',
	Progress = 'progress',
	Spinner = 'spinner',
	Avatar = 'avatar',
	Badge = 'badge',
	Tooltip = 'tooltip',
	Accordion = 'accordion'
}

export interface IComponentAnimation {
	trigger: AnimationTrigger;
	type: AnimationType;
	duration?: number;
	delay?: number;
	easing?: string;
}

export enum AnimationTrigger {
	Mount = 'mount',
	Unmount = 'unmount',
	Hover = 'hover',
	Focus = 'focus',
	Click = 'click',
	Scroll = 'scroll'
}

export enum AnimationType {
	FadeIn = 'fadeIn',
	FadeOut = 'fadeOut',
	SlideIn = 'slideIn',
	SlideOut = 'slideOut',
	ScaleIn = 'scaleIn',
	ScaleOut = 'scaleOut',
	Bounce = 'bounce',
	Pulse = 'pulse',
	Shake = 'shake',
	Glow = 'glow'
}

export interface IComponentAccessibility {
	ariaLabel?: string;
	ariaDescribedBy?: string;
	role?: string;
	tabIndex?: number;
	focusable?: boolean;
}

export interface IModernUIService {
	setTheme(theme: IUITheme): void;
	getTheme(): IUITheme;
	createComponent(type: ComponentType, props: Record<string, any>): IUIComponent;
	renderComponent(component: IUIComponent, container: HTMLElement): void;
	animateComponent(component: IUIComponent, animation: IComponentAnimation): Promise<void>;
	updateAccessibility(settings: Partial<IAccessibilitySettings>): void;
	onThemeChanged: Event<IUITheme>;
	onAnimationComplete: Event<{ component: IUIComponent; animation: IComponentAnimation }>;
}

/**
 * Modern UI System with:
 * - Beautiful, responsive design
 * - Smooth animations and micro-interactions
 * - Full accessibility support
 * - Theme customization
 * - Component-based architecture
 * - Performance optimizations
 */
export class ModernUIService extends Disposable implements IModernUIService {
	private readonly _onThemeChanged = new Emitter<IUITheme>();
	private readonly _onAnimationComplete = new Emitter<{ component: IUIComponent; animation: IComponentAnimation }>();
	
	readonly onThemeChanged = this._onThemeChanged.event;
	readonly onAnimationComplete = this._onAnimationComplete.event;

	private currentTheme: IUITheme;
	private components = new Map<string, IUIComponent>();
	private animationQueue: Array<{ component: IUIComponent; animation: IComponentAnimation }> = [];
	private styleSheet: HTMLStyleElement;

	constructor() {
		super();
		this.currentTheme = this.getDefaultTheme();
		this.initializeStyleSheet();
		this.setupAccessibilityObserver();
	}

	setTheme(theme: IUITheme): void {
		this.currentTheme = theme;
		this.updateThemeStyles();
		this._onThemeChanged.fire(theme);
	}

	getTheme(): IUITheme {
		return this.currentTheme;
	}

	createComponent(type: ComponentType, props: Record<string, any>): IUIComponent {
		const component: IUIComponent = {
			id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			type,
			props: {
				...this.getDefaultProps(type),
				...props
			},
			animations: this.getDefaultAnimations(type),
			accessibility: this.getDefaultAccessibility(type)
		};

		this.components.set(component.id, component);
		return component;
	}

	renderComponent(component: IUIComponent, container: HTMLElement): void {
		const element = this.createElement(component);
		
		// Apply animations
		if (component.animations) {
			const mountAnimation = component.animations.find(a => a.trigger === AnimationTrigger.Mount);
			if (mountAnimation) {
				this.animateComponent(component, mountAnimation);
			}
		}

		container.appendChild(element);
	}

	async animateComponent(component: IUIComponent, animation: IComponentAnimation): Promise<void> {
		return new Promise((resolve) => {
			const element = document.getElementById(component.id);
			if (!element) {
				resolve();
				return;
			}

			// Check for reduced motion preference
			if (this.currentTheme.animations.reducedMotion) {
				resolve();
				return;
			}

			const duration = animation.duration || this.currentTheme.animations.duration.normal;
			const easing = animation.easing || this.currentTheme.animations.easing.ease;
			const delay = animation.delay || 0;

			// Apply animation class
			element.classList.add(`animate-${animation.type}`);
			
			// Set CSS custom properties for animation
			element.style.setProperty('--animation-duration', `${duration}ms`);
			element.style.setProperty('--animation-easing', easing);
			element.style.setProperty('--animation-delay', `${delay}ms`);

			setTimeout(() => {
				element.classList.remove(`animate-${animation.type}`);
				this._onAnimationComplete.fire({ component, animation });
				resolve();
			}, duration + delay);
		});
	}

	updateAccessibility(settings: Partial<IAccessibilitySettings>): void {
		this.currentTheme.accessibility = {
			...this.currentTheme.accessibility,
			...settings
		};
		
		this.updateAccessibilityStyles();
		this.updateComponentsAccessibility();
	}

	private getDefaultTheme(): IUITheme {
		return {
			id: 'copilot-modern',
			name: 'Copilot Modern',
			colors: {
				primary: '#0969da',
				secondary: '#656d76',
				accent: '#7c3aed',
				background: '#ffffff',
				surface: '#f6f8fa',
				text: '#24292f',
				textSecondary: '#656d76',
				border: '#d0d7de',
				success: '#1a7f37',
				warning: '#d1242f',
				error: '#cf222e',
				info: '#0969da',
				gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
			},
			typography: {
				fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
				fontSize: {
					xs: '0.75rem',
					sm: '0.875rem',
					base: '1rem',
					lg: '1.125rem',
					xl: '1.25rem',
					'2xl': '1.5rem',
					'3xl': '1.875rem'
				},
				fontWeight: {
					normal: 400,
					medium: 500,
					semibold: 600,
					bold: 700
				},
				lineHeight: {
					tight: 1.25,
					normal: 1.5,
					relaxed: 1.75
				}
			},
			animations: {
				enabled: true,
				duration: {
					fast: 150,
					normal: 300,
					slow: 500
				},
				easing: {
					ease: 'ease',
					easeIn: 'ease-in',
					easeOut: 'ease-out',
					easeInOut: 'ease-in-out',
					bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
				},
				reducedMotion: false
			},
			accessibility: {
				highContrast: false,
				focusVisible: true,
				screenReaderOptimized: false,
				keyboardNavigation: true,
				fontSize: 'medium'
			}
		};
	}

	private initializeStyleSheet(): void {
		this.styleSheet = document.createElement('style');
		this.styleSheet.id = 'copilot-modern-ui-styles';
		document.head.appendChild(this.styleSheet);
		this.updateThemeStyles();
		this.addAnimationStyles();
	}

	private updateThemeStyles(): void {
		const theme = this.currentTheme;
		const css = `
			:root {
				/* Colors */
				--ui-primary: ${theme.colors.primary};
				--ui-secondary: ${theme.colors.secondary};
				--ui-accent: ${theme.colors.accent};
				--ui-background: ${theme.colors.background};
				--ui-surface: ${theme.colors.surface};
				--ui-text: ${theme.colors.text};
				--ui-text-secondary: ${theme.colors.textSecondary};
				--ui-border: ${theme.colors.border};
				--ui-success: ${theme.colors.success};
				--ui-warning: ${theme.colors.warning};
				--ui-error: ${theme.colors.error};
				--ui-info: ${theme.colors.info};
				--ui-gradient: ${theme.colors.gradient || 'none'};

				/* Typography */
				--ui-font-family: ${theme.typography.fontFamily};
				--ui-font-size-xs: ${theme.typography.fontSize.xs};
				--ui-font-size-sm: ${theme.typography.fontSize.sm};
				--ui-font-size-base: ${theme.typography.fontSize.base};
				--ui-font-size-lg: ${theme.typography.fontSize.lg};
				--ui-font-size-xl: ${theme.typography.fontSize.xl};
				--ui-font-size-2xl: ${theme.typography.fontSize['2xl']};
				--ui-font-size-3xl: ${theme.typography.fontSize['3xl']};

				/* Animation */
				--ui-duration-fast: ${theme.animations.duration.fast}ms;
				--ui-duration-normal: ${theme.animations.duration.normal}ms;
				--ui-duration-slow: ${theme.animations.duration.slow}ms;
				--ui-ease: ${theme.animations.easing.ease};
				--ui-ease-in: ${theme.animations.easing.easeIn};
				--ui-ease-out: ${theme.animations.easing.easeOut};
				--ui-ease-in-out: ${theme.animations.easing.easeInOut};
				--ui-ease-bounce: ${theme.animations.easing.bounce};
			}

			.copilot-ui-component {
				font-family: var(--ui-font-family);
				color: var(--ui-text);
			}

			/* High contrast mode */
			${theme.accessibility.highContrast ? this.getHighContrastStyles() : ''}
			
			/* Focus styles */
			${theme.accessibility.focusVisible ? this.getFocusStyles() : ''}
		`;

		this.styleSheet.textContent = css;
	}

	private addAnimationStyles(): void {
		const animationCSS = `
			/* Animation classes */
			.animate-fadeIn {
				animation: fadeIn var(--animation-duration, var(--ui-duration-normal)) var(--animation-easing, var(--ui-ease)) var(--animation-delay, 0ms);
			}

			.animate-fadeOut {
				animation: fadeOut var(--animation-duration, var(--ui-duration-normal)) var(--animation-easing, var(--ui-ease)) var(--animation-delay, 0ms);
			}

			.animate-slideIn {
				animation: slideIn var(--animation-duration, var(--ui-duration-normal)) var(--animation-easing, var(--ui-ease)) var(--animation-delay, 0ms);
			}

			.animate-slideOut {
				animation: slideOut var(--animation-duration, var(--ui-duration-normal)) var(--animation-easing, var(--ui-ease)) var(--animation-delay, 0ms);
			}

			.animate-scaleIn {
				animation: scaleIn var(--animation-duration, var(--ui-duration-normal)) var(--animation-easing, var(--ui-ease-bounce)) var(--animation-delay, 0ms);
			}

			.animate-scaleOut {
				animation: scaleOut var(--animation-duration, var(--ui-duration-normal)) var(--animation-easing, var(--ui-ease)) var(--animation-delay, 0ms);
			}

			.animate-bounce {
				animation: bounce var(--animation-duration, var(--ui-duration-slow)) var(--animation-easing, var(--ui-ease-bounce)) var(--animation-delay, 0ms);
			}

			.animate-pulse {
				animation: pulse var(--animation-duration, var(--ui-duration-normal)) var(--animation-easing, var(--ui-ease)) var(--animation-delay, 0ms) infinite;
			}

			.animate-shake {
				animation: shake var(--animation-duration, var(--ui-duration-fast)) var(--animation-easing, var(--ui-ease)) var(--animation-delay, 0ms);
			}

			.animate-glow {
				animation: glow var(--animation-duration, var(--ui-duration-slow)) var(--animation-easing, var(--ui-ease)) var(--animation-delay, 0ms) infinite alternate;
			}

			/* Keyframes */
			@keyframes fadeIn {
				from { opacity: 0; }
				to { opacity: 1; }
			}

			@keyframes fadeOut {
				from { opacity: 1; }
				to { opacity: 0; }
			}

			@keyframes slideIn {
				from { transform: translateY(-20px); opacity: 0; }
				to { transform: translateY(0); opacity: 1; }
			}

			@keyframes slideOut {
				from { transform: translateY(0); opacity: 1; }
				to { transform: translateY(-20px); opacity: 0; }
			}

			@keyframes scaleIn {
				from { transform: scale(0.8); opacity: 0; }
				to { transform: scale(1); opacity: 1; }
			}

			@keyframes scaleOut {
				from { transform: scale(1); opacity: 1; }
				to { transform: scale(0.8); opacity: 0; }
			}

			@keyframes bounce {
				0%, 20%, 53%, 80%, 100% { transform: translate3d(0,0,0); }
				40%, 43% { transform: translate3d(0, -30px, 0); }
				70% { transform: translate3d(0, -15px, 0); }
				90% { transform: translate3d(0, -4px, 0); }
			}

			@keyframes pulse {
				0% { opacity: 1; }
				50% { opacity: 0.5; }
				100% { opacity: 1; }
			}

			@keyframes shake {
				0%, 100% { transform: translateX(0); }
				10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
				20%, 40%, 60%, 80% { transform: translateX(10px); }
			}

			@keyframes glow {
				from { box-shadow: 0 0 5px var(--ui-primary); }
				to { box-shadow: 0 0 20px var(--ui-primary), 0 0 30px var(--ui-primary); }
			}

			/* Reduced motion */
			@media (prefers-reduced-motion: reduce) {
				.animate-fadeIn,
				.animate-fadeOut,
				.animate-slideIn,
				.animate-slideOut,
				.animate-scaleIn,
				.animate-scaleOut,
				.animate-bounce,
				.animate-pulse,
				.animate-shake,
				.animate-glow {
					animation: none !important;
				}
			}
		`;

		this.styleSheet.textContent += animationCSS;
	}

	private createElement(component: IUIComponent): HTMLElement {
		const element = document.createElement(this.getHTMLTag(component.type));
		element.id = component.id;
		element.className = `copilot-ui-component copilot-${component.type}`;

		// Apply component-specific styles
		this.applyComponentStyles(element, component);
		
		// Apply accessibility attributes
		if (component.accessibility) {
			this.applyAccessibilityAttributes(element, component.accessibility);
		}

		// Add event listeners for animations
		this.addAnimationEventListeners(element, component);

		return element;
	}

	private getHTMLTag(type: ComponentType): string {
		switch (type) {
			case ComponentType.Button: return 'button';
			case ComponentType.Modal: return 'dialog';
			case ComponentType.Progress: return 'progress';
			case ComponentType.Avatar: return 'img';
			default: return 'div';
		}
	}

	private applyComponentStyles(element: HTMLElement, component: IUIComponent): void {
		const baseStyles: Record<ComponentType, string> = {
			[ComponentType.Button]: `
				padding: 0.5rem 1rem;
				border-radius: 0.5rem;
				border: 1px solid var(--ui-border);
				background: var(--ui-primary);
				color: white;
				font-weight: var(--ui-font-weight-medium);
				cursor: pointer;
				transition: all var(--ui-duration-fast) var(--ui-ease);
			`,
			[ComponentType.Card]: `
				background: var(--ui-surface);
				border-radius: 0.75rem;
				padding: 1.5rem;
				box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
				border: 1px solid var(--ui-border);
			`,
			[ComponentType.Modal]: `
				background: var(--ui-background);
				border-radius: 1rem;
				padding: 2rem;
				box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
				border: 1px solid var(--ui-border);
				max-width: 32rem;
				width: 100%;
			`,
			[ComponentType.Toast]: `
				background: var(--ui-surface);
				border-radius: 0.5rem;
				padding: 1rem;
				box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
				border-left: 4px solid var(--ui-primary);
			`,
			[ComponentType.Progress]: `
				width: 100%;
				height: 0.5rem;
				background: var(--ui-border);
				border-radius: 0.25rem;
				overflow: hidden;
			`,
			[ComponentType.Spinner]: `
				width: 2rem;
				height: 2rem;
				border: 2px solid var(--ui-border);
				border-top: 2px solid var(--ui-primary);
				border-radius: 50%;
				animation: spin 1s linear infinite;
			`,
			[ComponentType.Avatar]: `
				width: 2.5rem;
				height: 2.5rem;
				border-radius: 50%;
				object-fit: cover;
				border: 2px solid var(--ui-border);
			`,
			[ComponentType.Badge]: `
				display: inline-flex;
				align-items: center;
				padding: 0.25rem 0.5rem;
				border-radius: 9999px;
				font-size: var(--ui-font-size-sm);
				font-weight: var(--ui-font-weight-medium);
				background: var(--ui-accent);
				color: white;
			`,
			[ComponentType.Tooltip]: `
				background: var(--ui-text);
				color: var(--ui-background);
				padding: 0.5rem 0.75rem;
				border-radius: 0.25rem;
				font-size: var(--ui-font-size-sm);
				white-space: nowrap;
				z-index: 1000;
			`,
			[ComponentType.Accordion]: `
				border: 1px solid var(--ui-border);
				border-radius: 0.5rem;
				overflow: hidden;
			`
		};

		const styles = baseStyles[component.type] || '';
		element.setAttribute('style', styles);
	}

	private applyAccessibilityAttributes(element: HTMLElement, accessibility: IComponentAccessibility): void {
		if (accessibility.ariaLabel) {
			element.setAttribute('aria-label', accessibility.ariaLabel);
		}
		if (accessibility.ariaDescribedBy) {
			element.setAttribute('aria-describedby', accessibility.ariaDescribedBy);
		}
		if (accessibility.role) {
			element.setAttribute('role', accessibility.role);
		}
		if (accessibility.tabIndex !== undefined) {
			element.setAttribute('tabindex', accessibility.tabIndex.toString());
		}
	}

	private addAnimationEventListeners(element: HTMLElement, component: IUIComponent): void {
		if (!component.animations) return;

		component.animations.forEach(animation => {
			switch (animation.trigger) {
				case AnimationTrigger.Hover:
					element.addEventListener('mouseenter', () => this.animateComponent(component, animation));
					break;
				case AnimationTrigger.Focus:
					element.addEventListener('focus', () => this.animateComponent(component, animation));
					break;
				case AnimationTrigger.Click:
					element.addEventListener('click', () => this.animateComponent(component, animation));
					break;
			}
		});
	}

	private getDefaultProps(type: ComponentType): Record<string, any> {
		const defaults: Record<ComponentType, Record<string, any>> = {
			[ComponentType.Button]: { variant: 'primary', size: 'medium' },
			[ComponentType.Card]: { elevation: 1 },
			[ComponentType.Modal]: { backdrop: true, closable: true },
			[ComponentType.Toast]: { duration: 5000, position: 'top-right' },
			[ComponentType.Progress]: { value: 0, max: 100 },
			[ComponentType.Spinner]: { size: 'medium' },
			[ComponentType.Avatar]: { size: 'medium' },
			[ComponentType.Badge]: { variant: 'primary' },
			[ComponentType.Tooltip]: { placement: 'top' },
			[ComponentType.Accordion]: { collapsible: true }
		};

		return defaults[type] || {};
	}

	private getDefaultAnimations(type: ComponentType): IComponentAnimation[] {
		const animations: Record<ComponentType, IComponentAnimation[]> = {
			[ComponentType.Button]: [
				{ trigger: AnimationTrigger.Hover, type: AnimationType.ScaleIn, duration: 150 }
			],
			[ComponentType.Card]: [
				{ trigger: AnimationTrigger.Mount, type: AnimationType.FadeIn, duration: 300 }
			],
			[ComponentType.Modal]: [
				{ trigger: AnimationTrigger.Mount, type: AnimationType.ScaleIn, duration: 300 },
				{ trigger: AnimationTrigger.Unmount, type: AnimationType.ScaleOut, duration: 200 }
			],
			[ComponentType.Toast]: [
				{ trigger: AnimationTrigger.Mount, type: AnimationType.SlideIn, duration: 300 },
				{ trigger: AnimationTrigger.Unmount, type: AnimationType.SlideOut, duration: 200 }
			],
			[ComponentType.Progress]: [],
			[ComponentType.Spinner]: [
				{ trigger: AnimationTrigger.Mount, type: AnimationType.FadeIn, duration: 200 }
			],
			[ComponentType.Avatar]: [
				{ trigger: AnimationTrigger.Mount, type: AnimationType.FadeIn, duration: 200 }
			],
			[ComponentType.Badge]: [
				{ trigger: AnimationTrigger.Mount, type: AnimationType.ScaleIn, duration: 200 }
			],
			[ComponentType.Tooltip]: [
				{ trigger: AnimationTrigger.Mount, type: AnimationType.FadeIn, duration: 150 }
			],
			[ComponentType.Accordion]: []
		};

		return animations[type] || [];
	}

	private getDefaultAccessibility(type: ComponentType): IComponentAccessibility {
		const accessibility: Record<ComponentType, IComponentAccessibility> = {
			[ComponentType.Button]: { role: 'button', tabIndex: 0, focusable: true },
			[ComponentType.Card]: { role: 'article' },
			[ComponentType.Modal]: { role: 'dialog', focusable: true },
			[ComponentType.Toast]: { role: 'alert' },
			[ComponentType.Progress]: { role: 'progressbar' },
			[ComponentType.Spinner]: { role: 'status', ariaLabel: 'Loading' },
			[ComponentType.Avatar]: { role: 'img' },
			[ComponentType.Badge]: { role: 'status' },
			[ComponentType.Tooltip]: { role: 'tooltip' },
			[ComponentType.Accordion]: { role: 'region' }
		};

		return accessibility[type] || {};
	}

	private getHighContrastStyles(): string {
		return `
			.copilot-ui-component {
				border: 2px solid var(--ui-text) !important;
			}
			
			.copilot-button:focus,
			.copilot-ui-component:focus {
				outline: 3px solid var(--ui-accent) !important;
				outline-offset: 2px !important;
			}
		`;
	}

	private getFocusStyles(): string {
		return `
			.copilot-ui-component:focus {
				outline: 2px solid var(--ui-primary);
				outline-offset: 2px;
			}
			
			.copilot-ui-component:focus:not(:focus-visible) {
				outline: none;
			}
		`;
	}

	private updateAccessibilityStyles(): void {
		// Update styles based on accessibility settings
		this.updateThemeStyles();
	}

	private updateComponentsAccessibility(): void {
		// Update all rendered components with new accessibility settings
		this.components.forEach(component => {
			const element = document.getElementById(component.id);
			if (element && component.accessibility) {
				this.applyAccessibilityAttributes(element, component.accessibility);
			}
		});
	}

	private setupAccessibilityObserver(): void {
		// Listen for system accessibility changes
		if (window.matchMedia) {
			const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
			reducedMotionQuery.addEventListener('change', (e) => {
				this.currentTheme.animations.reducedMotion = e.matches;
				this.updateThemeStyles();
			});

			const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
			highContrastQuery.addEventListener('change', (e) => {
				this.currentTheme.accessibility.highContrast = e.matches;
				this.updateThemeStyles();
			});
		}
	}
}