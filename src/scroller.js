/*
 * Copyright (C) 2013 salesforce.com, inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
(function (w) {
    'use strict';

    // GLOBALS UTILS
    var NOW            = Date.now || function () { return new Date().getTime(); },
        RAF            = w.requestAnimationFrame,
        CAF            = w.cancelAnimationFrame,

    // NAMESPACES
        SCROLLER       = w.__S || {},
        PLUGINS        = SCROLLER.plugins,
        HELPERS        = SCROLLER.helpers,
        SUPPORT        = SCROLLER.support,
        STYLES         = SCROLLER.styles,
        CubicBezier    = SCROLLER.CubicBezier,

        /*
        * For the sake of simplicity, these action-string
        * constants won't be exposed as STATIC variables 
        * in the Scroller.
        */
        ACTION_RESET         = 'reset',
        ACTION_LOCK          = 'lock',
        ACTION_GESTURE_START = 'gestureStart',
        ACTION_GESTURE_MOVE  = 'gestureMove',
        ACTION_GESTURE_END   = 'gestureEnd',
        ACTION_ANIM_MOVING   = 'animationMove',
        ACTION_ANIM_END      = 'animationEnd',
        HOOK_BEFORE          = 'before',
        HOOK_AFTER           = 'after',

        /**
        * Distinguish the type of touch events so they don't conflict in certain
        * contexts, like Dual gestures on Windows Tablets or in ChromeDevTools. 
        * (There's a bug where enabling touch gestures fires both types.)
        *
        */
        EVENT_TYPE = {
            touchstart : 1,
            touchmove  : 1,
            touchend   : 1,

            mousedown : 2,
            mousemove : 2,
            mouseup   : 2,

            pointerdown : 3,
            pointermove : 3,
            pointerup   : 3,

            MSPointerDown : 4,
            MSPointerMove : 4,
            MSPointerUp   : 4
        },

        /**
        * Identifies vertical scrolling.
        *
        * @property SCROLL_VERTICAL
        * @type String
        * @static
        * @final
        */
        SCROLL_VERTICAL = 'vertical',

        /**
        * Identifies horizontal scrolling.
        *
        * @property SCROLL_HORIZONTAL
        * @type String
        * @static
        * @final
        */
        SCROLL_HORIZONTAL = 'horizontal',

        /**
        * Default configuration for the scroller.
        * This option can be modified at the static level
        * or on a per instance basis.
        *
        * @property DEFAULTS
        * @type String
        * @static
        */
        DEFAULTS = {
            enabled               : true,
            bounceTime            : 600,
            useCSSTransition      : false,
            dualListeners         : false,
            minThreshold          : 5,     // It should be in the [0, 10] range
            minDirectionThreshold : 2,     // It should be smaller than minThreshold
            lockOnDirection       : null,
            itemHeight            : null,
            itemWidth             : null,
            bindToWrapper         : false,
            scroll                : SCROLL_VERTICAL,
            pullToRefresh         : false,
            pullToLoadMore        : false,
            scrollbars            : false,
            infiniteLoading       : false,
            gpuOptimization       : false,
            debounce              : true
        },

        /**
        * Default parametrized CubicBezier function curve 
        * that is used on regular scrolling.
        * @property EASING_REGULAR
        * @type {function}
        * @static
        * @default "CubicBezier(0.33, 0.66, 0.66, 1)"
        */
        EASING_REGULAR = CubicBezier(0.33, 0.66, 0.66, 1),

        /**
        * Default parametrized CubicBezier function curve 
        * that is used when the scroller goes out of limits.
        * @property EASING_BOUNCE
        * @type {function}
        * @static
        * @default "CubicBezier(0.33, 0.33, 0.66, 0.81)"
        */
        EASING_BOUNCE  = CubicBezier(0.33, 0.33, 0.66, 0.81),

        /**
        * Wraps EASING_REGULAR and EASING_BOUNCE 
        * with the corresponding string representation.
        *
        * @property EASING
        * @type {Object}
        * @static
        * @final
        * @default "{regular: {}, bounce: {}}"
        */
        EASING = {
            regular : {
                style : EASING_REGULAR.toString(),
                fn    : EASING_REGULAR
            },
            bounce : {
                style : EASING_BOUNCE.toString(),
                fn    : EASING_BOUNCE,
            }
        },

        /**
        * Specifies the minimum velocity required to scroll. 
        *
        * @property MIN_VELOCITY
        * @type {float}
        * @static
        * @default "0.1"
        */
        MIN_VELOCITY          = 0.1,

        /**
        * Specifies the acceleration constant px/ms².
        *
        * @property ACCELERATION_CONSTANT
        * @type {float}
        * @static
        * @default "0.0005"
        */
        ACCELERATION_CONSTANT = 0.0005,

        /**
        * Specifies the mouse wheel speed.
        *
        * @property MOUSE_WHEEL_SPEED
        * @type {integer}
        * @static
        * @default "20"
        */
        MOUSE_WHEEL_SPEED     = 20,

        /**
        * Specifies whether or not mouse wheel movements should be inverted.
        *
        * @property MOUSE_WHEEL_INVERTED
        * @type {boolean}
        * @static
        * @default "false"
        */
        MOUSE_WHEEL_INVERTED  = false;

    /**
    * Scroller class that provides the core logic for scrolling.
    *
    * @class Scroller
    * @param el {HTMLElement} DOM element to attach the Scroller.
    * @param config {Object} Object literal with initial attribute values.
    * @constructor
    */
    function Scroller (el, config) {
        config || (config = {});
        
        this._initializeScroller();
        this._setConfig(config);
        this._setElement(el);
        this._setSize();
        this._initializePlugins(config);
        this._initialize();

        this._handleEvents('bind');
    }

    // Attach and expose Statics into the Scroller Class
    Scroller.DEFAULTS              = DEFAULTS;
    Scroller.CubicBezier           = CubicBezier;
    Scroller.EASING_REGULAR        = EASING_REGULAR;
    Scroller.EASING_BOUNCE         = EASING_BOUNCE;
    Scroller.EASING                = EASING;
    Scroller.MIN_VELOCITY          = MIN_VELOCITY;
    Scroller.ACCELERATION_CONSTANT = ACCELERATION_CONSTANT;
    Scroller.SCROLL_VERTICAL       = SCROLL_VERTICAL;
    Scroller.SCROLL_HORIZONTAL     = SCROLL_HORIZONTAL;
    Scroller.MOUSE_WHEEL_SPEED     = MOUSE_WHEEL_SPEED;
    Scroller.MOUSE_WHEEL_INVERTED  = MOUSE_WHEEL_INVERTED;
    Scroller.plugins               = PLUGINS;

    Scroller.prototype = {
        /**
        * Called in the constructor.
        * Initializes the internal state of the instance.
        *
        * @method _initializeScroller
        * @private
        */
        _initializeScroller: function () {
            this._events = {};
            this.x       = 0;
            this.y       = 0;
        },
        /**
        * Called in the constructor.
        * Fires an event to nofify plugins 
        * that they can initialize themselves.
        *
        * @method _initialize
        * @private
        */
        _initialize: function () {
            this._fire('_initialize');
        },
        /**
        * Initializes the plugins provided in the configuration object.
        * By default the scroller tries to initialize core plugins, such as
        * `SurfaceManager,` `PullToRefresh,` and `PullToLoadMore`.
        *
        * @method _initializePlugins
        * @param cfg {Object} Scroller configuration object
        * @private
        */
        _initializePlugins: function (cfg) {
            var userPlugins    = this.opts.plugins,
                SurfaceManager = PLUGINS.SurfaceManager,
                PullToRefresh  = PLUGINS.PullToRefresh,
                PullToLoadMore = PLUGINS.PullToLoadMore,
                enableSM       = !this.opts.useCSSTransition && this.opts.gpuOptimization,
                enablePTR      = this.opts.onPullToRefresh,
                enablePTL      = this.opts.onPullToLoadMore;
            
            if (enablePTR && PullToRefresh)  {
                this.plug(PullToRefresh);
            }
            if (enablePTL && PullToLoadMore) {
                this.plug(PullToLoadMore);
            }
            if (enableSM  && SurfaceManager) {
                this.plug(SurfaceManager);
            }

            if (userPlugins) {
                userPlugins.forEach(function (plugin) {
                    this.plug(plugin);
                }, this);
            }
        },
        /**
        * Helper method to merge two object configurations.
        * Relies on the `Helpers` utility module.
        *
        * @method _initializePlugins
        * @param cfg {Object} Configuration base
        * @param toMerge {Object} Configuration to merge
        * @return {Object} An object that merges both configuration properties.
        * @private
        */
        _mergeConfigOptions: function (cfg, toMerge) {
            return HELPERS.simpleMerge(cfg, toMerge);
        },
        /**
        * Merges the default configuration with the configuraton provided by the 
        * user and attaches the options to the instances.
        * Also copies some options directly to the instance for easy access to them.
        *
        * @method _setConfig
        * @param cfg {Object} Configuration base
        * @private
        */
        _setConfig: function (cfg) {
            var opts = this.opts = this._mergeConfigOptions(DEFAULTS, cfg);

            this.enabled               = opts.enabled;
            this.scroll                = opts.scroll;
            this.itemHeight            = opts.itemHeight;
            this.itemWidth             = opts.itemWidth;

            this.acceleration          = opts.acceleration || ACCELERATION_CONSTANT;
            this.scrollVertical        = this.scroll === SCROLL_VERTICAL;
            
            // Guard for missconfigurations

            if (opts.infiniteLoading && opts.pullToLoadMore) {
                w.DEBUG.warn(
                    'You cannot have infiniteLoading and pullToShowMore at the same time.' +
                    'Switching to infiniteLoading');
                this.opts.pullToLoadMore = false;
            }

            if (!this.scrollVertical && (opts.pullToRefresh || opts.pullToLoadMore)) {
                w.DEBUG.warn(
                    'The attributes: pullToRefresh or pullToShowMore are not available in horizontal mode yet.'+
                    ' Switching them to false');

                this.opts.pullToRefresh  = false;
                this.opts.pullToLoadMore = false;
            }
        },
        /**
        * Finds the DOM element where the scroller will be hosted. 
        * The provided element will be the `scroller-wrapper` 
        * and the first child is the one that performs the scroll.
        * This method also sets the proper class to the wrapper, depending 
        * on `scrollDirection` set in the configuration.
        *
        * @method _setElement
        * @param el {string|HTMLElement} Element to which the scroller is attached
        * @private
        */
        _setElement: function (el) {
            this.wrapper       = typeof el === 'string' ? w.document.querySelector(el) : el;
            this.scroller      = this.wrapper.children[0];
            this.scrollerStyle = this.scroller.style;

            this.scroller.classList.add('scroller');
            this.scroller.classList.add( this.scrollVertical ? 'scroll-vertical' : 'scroll-horizontal');
        },
        /**
        * Queries the wrapper element to get the updated size, in width and height.
        * The element must be in the DOM to get the right measurement.
        * The scroller won't work correctly if this attribute is set incorrectly.
        *
        * @method _setWrapperSize
        * @private
        */
        _setWrapperSize: function () {
            this.wrapperWidth  = this.wrapper.clientWidth;
            this.wrapperHeight = this.wrapper.clientHeight;
            this.wrapperSize   = this.scrollVertical ? this.wrapperHeight : this.wrapperWidth;
        },
        /**
        * Sets the overall sizes of the scroller.
        * Calculates the actual scrollable area and sets the proper internal state.
        * Note that this has a small dependency on the `PullToLoadMore` plugin.
        *
        * @method _setWrapperSize
        * @private
        */
        _setSize: function () {
            var scrollerDOM = this.scroller,
                // We need to take into account if the `PullToLoadMore` plugin is active
                // and in that case substract the height from the scrollable area size
                ptl         = this.opts.pullToLoadMore,
                ptl_offset  = this._ptlThreshold || 0;

            this._setWrapperSize();
            this._sizePullToShowMore();

            // Once all the sizes are accurate, performn the scroll size calculations
            this.scrollerWidth  = scrollerDOM.offsetWidth;
            this.scrollerHeight = ptl ? scrollerDOM.offsetHeight - ptl_offset : scrollerDOM.offsetHeight;

            this.maxScrollX     = this.wrapperWidth  - this.scrollerWidth;
            this.maxScrollY     = this.wrapperHeight - this.scrollerHeight;

            this.maxScrollX     = this.maxScrollX > 0 ? 0 : this.maxScrollX;
            this.maxScrollY     = this.maxScrollY > 0 ? 0 : this.maxScrollY;

            this.hasScrollX     = this.maxScrollX < 0;
            this.hasScrollY     = this.maxScrollY < 0;

        },
        /**
        * To be overriden by the `PullToShowMore` plugin.
        * Calculates the height of `PullToShowMore` so
        * it can be taken into account when calculating the total scrollable size.
        *
        * @method _setPullToShowMore
        * @private
        */
        _sizePullToShowMore: function () {
            //To be overriden
        },
        /**
        * Private destroy function that is responsible for the destruction of the
        * instance itself. 
        * The plugins destroy themselves, as triggered by the public
        * `destroy` method.
        *
        * @method _destroy
        * @private
        */
        _destroy: function () {
            this._handleEvents('unbind');
        },

    /* 
    * ==================================================
    * Event handling and bindings
    * ================================================== 
    */

        /**
        * Add or remove all of the neccesary event listeners, based on the provided configuration.
        *
        * @params action {string} Action to bind or unbind events
        * @method _handleEvents
        * @private
        */
        _handleEvents: function (action) {
            var eventType = action === 'bind' ? HELPERS.bind : HELPERS.unbind,
                wrapper   = this.wrapper,
                target    = this.opts.bindToWrapper ? wrapper : window,
                pHandlers = false, // pointerHandlers flag
                scroller  = this.scroller;

            eventType(window, 'orientationchange', this);
            eventType(window, 'resize', this);

            if (SUPPORT.touch && !this.opts.disableTouch) {
                eventType(wrapper, 'touchstart',  this);
                eventType(target,  'touchmove',   this);
                eventType(target,  'touchcancel', this);
                eventType(target,  'touchend',    this);
            }

            if ((SUPPORT.pointers || SUPPORT.msPointers) && !this.opts.disablePointers) {
                if (SUPPORT.pointers) {
                    eventType(wrapper, 'pointerdown',   this);
                    eventType(target,  'pointermove',   this);
                    eventType(target,  'pointercancel', this);
                    eventType(target,  'pointerup',     this);
                } else {
                    eventType(wrapper, 'MSPointerDown',   this);
                    eventType(target,  'MSPointerMove',   this);
                    eventType(target,  'MSPointerCancel', this);
                    eventType(target,  'MSPointerUp',     this);
                }
                pHandlers = true;
            }

            // Surface devices can have both mouse and pointer events
            if (!this.opts.disableMouse && (!pHandlers || (pHandlers && this.opts.dualListeners))) {
                eventType(wrapper, 'mousedown',   this);
                eventType(target,  'mousemove',   this);
                eventType(target,  'mousecancel', this);
                eventType(target,  'mouseup',     this);
            }

            if (!this.opts.disableWheel) {
                eventType(wrapper, 'wheel', this);
                eventType(wrapper, 'mousewheel', this);
                eventType(wrapper, 'DOMMouseScroll', this);
            }

            eventType(this.scroller, 'transitionend', this);
            eventType(this.scroller, SUPPORT.prefix + 'TransitionEnd', this);
        },

        /**
        * Fire a custom event by name.
        * The callback functions are executed with the scroller instance as context, and with the parameters listed here.
        * The first argument is the event type and any additional arguments are passed to the listeners as parameters.
        * This is used to notify the plugins of events that occur on the scroller.
        *
        * @params eventType {string} Type of event to be dispatched
        * @params arguments {object} An arbitrary set of parameters to pass to the listeners
        * @method _fire
        * @private
        */
        _fire: function (eventType /*,arguments*/) {
            var eventQueue = this._events[eventType],
                eventFncs  = eventQueue && eventQueue.length,
                params     = Array.prototype.slice.call(arguments, 1),
                ePayload;
                
            if (eventFncs) {
                for (var i = 0; i < eventFncs; i++) {
                    ePayload = eventQueue[i];
                    ePayload.fn.apply(ePayload.context || this, params);
                }
            }
        },

        /**
        * Hook mechanism that allows plugins to run functions before or after 
        * the execution of a particular scroller function.
        *
        * @params when {string} When to execute the hooked function (before|after)
        * @params method {string} Where to perform the hook
        * @params method {function} Hook function to execute
        * @method _hook
        * @private
        */
        _hook: function (when, method, hookFn) {
            var self         = this,
                toHookMethod = this[method];
            
            if (toHookMethod) {
                if (when === HOOK_AFTER) {
                    this[method] = function () {
                        var ret = toHookMethod.apply(this, arguments);
                        return hookFn.call(this, ret);
                    };
                } else if (when === HOOK_BEFORE) {
                    this[method] = function () {
                        hookFn.apply(this, arguments);
                        toHookMethod.apply(this, arguments);
                    };
                }
            }
        },
        /**
        * Handler to dispatch all of the events that the scroller listens to.
        * The browser calls this function if any of the events 
        * registered in _handleEvents are triggered.
        *
        * @params e {event} The event provided by the browser
        * @method handleEvent
        * @private
        */
        handleEvent: function (e) {
            switch ( e.type ) {
                case 'touchstart':
                case 'pointerdown':
                case 'MSPointerDown':
                case 'mousedown':
                    this._start(e);
                    break;
                case 'touchmove':
                case 'pointermove':
                case 'MSPointerMove':
                case 'mousemove':
                    this._move(e);
                    break;
                case 'touchend':
                case 'pointerup':
                case 'MSPointerUp':
                case 'mouseup':
                case 'touchcancel':
                case 'pointercancel':
                case 'MSPointerCancel':
                case 'mousecancel':
                    this._end(e);
                    break;
                case 'orientationchange':
                case 'resize':
                    this.resize();
                    break;
                case 'transitionend':
                case SUPPORT.prefix + 'TransitionEnd':
                    this._transitionEnd(e);
                    break;
                case 'wheel':
                case 'DOMMouseScroll':
                case 'mousewheel':
                    this._wheel(e);
                    break;
            }
        },
    /* 
    * ==================================================
    * Scroller gestures
    * ================================================== 
    */

        /**
        * Handles the start gesture event.
        *
        * @params e {event} The gesturestart event provided by the browser
        * @method handleEvent
        * @private
        */
        _start: function (e) {
            if ( !this.enabled || (this._initiated && EVENT_TYPE[e.type] !== this._initiated)) {
                return;
            }

            var point = e.touches ? e.touches[0] : e;

            // Reset internal state
            this._initiated      = EVENT_TYPE[e.type]; // Register eventType so we can't prevent conflicts
            this.moved           = false;
            this.distX           = 0;
            this.distY           = 0;
            this.velocity        = 0;
            this.scrollDirection = null;

            this._transitionTime();    // Reset CSS transition timing
            this._isAnimating = false;

            // If we are in the middle of a scrolling we need to stop everything and reset
            if (this._isScrolling) {
                this._stopMomentum();
                this._isScrolling = false;
                this._onStopScrolling(e);
            }

            // Set current position and time
            this.startX         = this.x;
            this.startY         = this.y;
            this.pointX         = point.pageX;
            this.pointY         = point.pageY;
            this.startTime      = NOW();
            this._lastPosition  = this.scrollVertical ? this.startY : this.startX;

            // Fires public event
            this._fire('beforeScrollStart', ACTION_GESTURE_START, e);
        },

        /**
        * Invoked if a gestureStart event occurs while scrolling.
        * By default, it will `preventDefault()` the start event so if a link is clicked, 
        * it won't trigger browser navigation.
        *
        * @params e {event} The gesturemove event provided by the browser
        * @method _onStopScrolling
        * @protected
        */
        _onStopScrolling: function (e) {
            e.preventDefault();
        },
        /**
        * Tracks and calculates the velocity of the gesture between two points in time.
        * Executed when scroller option `debounce: true` in the context of a `requestAnimationFrame` (every ~17ms).
        * It uses the delta for both position and time between the current and previous frames to get the current velocity value,
        * then it applies an exponential moving average filter to weight and smooth out the final velocity.
        * 
        *
        * @params e {event} The gesturemove event provided by the browser
        * @method _trackVelocity
        * @protected
        */
        _trackVelocity: function (t) {
            var lastPos    = this._lastPosition,
                currentPos = this.scrollVertical ? this.y : this.x,
                elapsed    = 17, //ms between frames (RAF calss), hardcoded due to inconsistencies in different devices
                delta      = currentPos - lastPos,
                v;

            this._lastPosition  = currentPos;

            v = delta / elapsed; // velocity relative to this frame

            // Applying exponential moving average filter
            this.velocity = 0.6 * v + 0.4 * this.velocity;
        },
        /**
        * Starts a `requestAnimationFrame` loop when a gestureMove is triggered 
        * to debounce the event from the animation.
        * For each frame, it updates the position and velocity, and 
        * fires a private `_update` event to any plugin listening to it.
        *
        * @method _startMoveRAF
        * @private
        */
        _startMoveRAF: function () {
            var self = this;
            function moveStep (t) {
                self._translate(self.x, self.y);
                self._trackVelocity(t);
                self._update();
                self._fire('scrollMove', ACTION_GESTURE_MOVE, self.x, self.y);
                self._rafMoving = RAF(moveStep);
            }
            moveStep();
        },
        /**
        * Stops the `requestAnimationFrame` debounce loop when gestureEnd is triggered.
        *
        * @method _endMoveRAF
        * @private
        */
        _endMoveRAF: function () {
            CAF(this._rafMoving);
        },
        /**
        * Fires and broadcasts a private `_update` event.
        * This function is critical for notifying the plugins that the scroller is moving.
        *
        * @method _endMoveRAF
        * @private
        */
        _update: function () {
            this._fire('_update');
        },

        /**
        * Checks if the scroller needs locking (will become inactive).
        * By default, the scroller is locked if `lockOnDirection` is defined 
        * and it matches the current scrollDirection of the gesture.
        * This can be useful when dealing with multiple nested scrollers 
        * which operate in different directions.
        *
        * @method _needsLocking
        * @private
        */
        _needsLocking: function () {
            return  this.opts.lockOnDirection &&
                    this.scrollDirection &&
                    this.opts.lockOnDirection === this.scrollDirection;
        },

        /**
        * Deactivates the scroller for a given gesture and fires the private `lock` event.
        *
        * @method _lockScroller
        * @private
        */
        _lockScroller: function () {
            this._initiated = false;
            this._fire(ACTION_LOCK, this.scrollDirection);
        },

        /**
        * Get the scroll direction once the gesture is bigger than a 
        * given threshold (via the `minDirectionThrehold` option).
        *
        * @params absX {integer} Absolute value of the x coordinate
        * @params absY {integer} Absolute value of the y coordinate
        * @method _getScrollDirection
        * @protected
        */
        _getScrollDirection: function (absX, absY) {
            var treshold = this.opts.minDirectionThreshold;
            this.scrollDirection =
                (absX > absY + treshold) ? SCROLL_HORIZONTAL :
                (absY > absX + treshold) ? SCROLL_VERTICAL :
                null;

            return this.scrollDirection;
        },

        /**
        * Checks the current position. 
        *
        * @params absX {integer} Current x coordinate
        * @params absY {integer} Current y coordinate
        * @method _isOutOfScroll
        * @private
        */
        _isOutOfScroll: function (x, y) {
            return this.scrollVertical ? (y > 0 || y < this.maxScrollY) : (x > 0 || x < this.maxScrollX);
        },

        /**
        * Normalizes and sets the coordinate that is not being scrolled 
        * to 0 so it moves in one direction only.
        *
        * @params absX {integer} Current x coordinate
        * @params absY {integer} Current y coordinate
        * @method _setNormalizedXY
        * @private
        */
        _setNormalizedXY: function (x, y) {
            if (this.scrollVertical) {
                this.x = 0;
                this.y = y;
            } else {
                this.x = x;
                this.y = 0;
            }
        },
        /**
        * Handles move gesture event.
        *
        * @params e {event} The gesturemove event provided by the browser
        * @method _move
        * @private
        */
        _move: function (e) {
            if (!this.enabled || (EVENT_TYPE[e.type] !== this._initiated)) {
                e.scrollDirection = this.scrollDirection; // keep bubbling up the direction if is defined
                return;
            }

            var point     = e.touches ? e.touches[0] : e,
                deltaX    = point.pageX - this.pointX,
                deltaY    = point.pageY - this.pointY,
                timestamp = NOW(),
                newX, newY, absDistX, absDistY;

            // if movement is detected
            if (!this.moved && (deltaX || deltaY)) {
                this.moved = true;
                this._translate(this.x, this.y);
                this._fire('scrollStart', ACTION_GESTURE_START, e); // notify listeners
                if (!this.opts.useCSSTransition || this.opts.debounce) {
                    this._startMoveRAF(); // start requestAnimationFrame for debouncing the move event
                }
            }
            // Update position and state
            this.pointX  = point.pageX;
            this.pointY  = point.pageY;
            this.distX   = this.distX + deltaX;
            this.distY   = this.distY + deltaY;
            absDistX     = Math.abs(this.distX);
            absDistY     = Math.abs(this.distY);
            newX         = this.x + deltaX;
            newY         = this.y + deltaY;

            // Calculate and expose the gesture direction
            e.scrollDirection = this.scrollDirection || this._getScrollDirection(absDistX, absDistY);

            if (this._needsLocking()) {
                this._lockScroller();
                return;
            }

            // If minThrehold is defined, do not start moving until the distance is over it. 
            if (this.opts.minThreshold && (absDistX < this.opts.minThreshold && absDistY < this.opts.minThreshold)) {
                this._fire('scrollMove', ACTION_GESTURE_MOVE, this.x, this.y, e);
                return;
            }

            // Reduce scrollability (slowdown) when dragging beyond the scroll limits
            if (this._isOutOfScroll(newX, newY)) {
                newY = this.y + deltaY / 3;
                newX = this.x + deltaX / 3;
            }

            // Scroll one direction at the time (set zero values on the other direction)
            this._setNormalizedXY(newX, newY);

            if (this.opts.useCSSTransition && !this.opts.debounce) {
                // If debounce is set to false, we force the browser to update the position every time
                this._translate(this.x, this.y);
                this._fire('scrollMove', ACTION_GESTURE_MOVE, this.x, this.y, e);

                // The timeStart reset helps keeping track only on the recent past of the gesture
                // which reduces variability and gets a more consistent velocity calculation
                if (timestamp - this.startTime > 300) {
                    this.startTime = timestamp;
                    this.startX = this.x;
                    this.startY = this.y;
                }
            }
        },
        /**
        * Handles end gesture event.
        *
        * @params e {event} The gesturemove event provided by the browser
        * @method _end
        * @private
        */
        _end: function (e) {
            this._endMoveRAF(); // Always cancel the debounce RAF

            if (!this.enabled || !this.moved || (EVENT_TYPE[e.type] !== this._initiated)) {
                return;
            }

            this._initiated = false;

            var duration = NOW() - this.startTime,
                time     = 0,
                bounce   = EASING.regular,
                momentum;

            // If its outside the scrolling boundaries at this point (pos > 0 || pos < maxScroll),
            // Just snap back (reset the position to be within the scrollable area)
            if (this._resetPosition(this.opts.bounceTime)) {
                return;
            }

            // If we arrive here, is time to scroll!
            this._isScrolling = true;

            // Calculate the momentum {destination, time} based on the gesture
            if (this.scrollVertical) {
                momentum = this._momentum(this.y, this.startY, duration, this.maxScrollY, this.wrapperHeight);
                this._scrollTo(0, momentum.destination, momentum.time, momentum.bounce);
            } else {
                momentum = this._momentum(this.x, this.startX, duration, this.maxScrollX, this.wrapperWidth);
                this._scrollTo(momentum.destination, 0, momentum.time, momentum.bounce);
            }
        },

        /**
        * Handles the wheel event for scrolling.
        *
        * @params e {event} The wheel event provided by the browser
        * @method _wheel
        * @private
        */
        _wheel: function (e) {
            if (!this.enabled) {
                return;
            }
            // Stop browser defaults
            e.preventDefault();
            e.stopPropagation();

            var self                 = this,
                mouseWheelSpeed      = Scroller.MOUSE_WHEEL_SPEED,
                invertWheelDirection = Scroller.MOUSE_WHEEL_INVERTED ? -1 : 1,
                wheelDeltaX, wheelDeltaY, newX, newY;

            // NOTE: The math behind this function was taken from iScroll.
            // Eventually revisit the logic to make sure is cross platform compatible

            if ( 'deltaX' in e ) {
                wheelDeltaX = -e.deltaX;
                wheelDeltaY = -e.deltaY;
            } else if ( 'wheelDeltaX' in e ) {
                wheelDeltaX = e.wheelDeltaX / 120 * mouseWheelSpeed;
                wheelDeltaY = e.wheelDeltaY / 120 * mouseWheelSpeed;
            } else if ( 'wheelDelta' in e ) {
                wheelDeltaX = wheelDeltaY = e.wheelDelta / 120 * mouseWheelSpeed;
            } else if ( 'detail' in e ) {
                wheelDeltaX = wheelDeltaY = -e.detail / 3 * mouseWheelSpeed;
            } else {
                return;
            }

            wheelDeltaX *= invertWheelDirection;
            wheelDeltaY *= invertWheelDirection;

            if (!this.scrollVertical) {
                wheelDeltaX = wheelDeltaY;
                wheelDeltaY = 0;
            }

            newX = this.x + Math.round(this.hasScrollX ? wheelDeltaX : 0);
            newY = this.y + Math.round(this.hasScrollY ? wheelDeltaY : 0);

            if (newX > 0) {
                newX = 0;
            } else if ( newX < this.maxScrollX ) {
                newX = this.maxScrollX;
            }

            if (newY > 0) {
                newY = 0;
            } else if ( newY < this.maxScrollY ) {
                newY = this.maxScrollY;
            }

            this.x = newX;
            this.y = newY;

            if (!this._rafWheel) {
                this._rafWheel = RAF(function (t) {
                    self._isScrolling = true;
                    self.distY = wheelDeltaY;
                    self.distX = wheelDeltaX;
                    self._wheelRAF(); // Debounce event from animation
                });
            }
        },
        /**
        * Handles the debounce of the wheel event to decouple the event and the actual DOM update.
        *
        * @params e {event} The wheel event provided by the browser
        * @method _wheelRAF
        * @private
        */
        _wheelRAF: function () {
            this._translate(this.x, this.y);
            this._update();
            this._rafWheel    = false;
            this._isScrolling = false;
        },

        /* 
        * ==================================================
        * Scroller Maths and calculation
        * ================================================== 
        */


        /**
        * Gets the velocity of the gesture.
        * If `debounce:true`, the velocity has been already calculated through `_trackVelocity`.
        * Otherwise, the value is determined from the current state of the scroller.
        *
        * @params current {float} Current position of the scroller
        * @params start {float} Start position of the scroller when the gesture started
        * @params time  {integer Duration of the gesture
        * @method _getVelocity
        * @return {float} Velocity of the gesture
        * @protected
        */
        _getVelocity: function (current, start, time) {
            var v = this.opts.debounce ? this.velocity : ((current - start) / time);
            if (Math.abs(v) < MIN_VELOCITY) { // if the velocity is really low, assume no movement
                v = 0;
            }
            this.velocity = v;
            return v;
        },

        /**
        * Calculates the momentum {destination, time} based on the velocity of the gesture and on the
        * acceleration.
        *
        * @params velocity {float} Velocity of the gesture
        * @params current {float} Current scroller position
        * @method _computeMomentum
        * @return {Object} An object with the destination and time where the scroller should go.
        * @protected
        */
        _computeMomentum: function (velocity, current) {
            var acceleration = this.acceleration,
                time         = Math.abs(velocity) / acceleration, // t = v / a
                distance     = velocity / 2 * time; // ΔX = vt + 1/2 at² = v / 2 * t 

            return {
                destination : current + distance,
                time        : time
            };
        },

        /**
        * Calculates the snap momentum.
        * If the original momentum calculation indicates that the 
        * destination of the scroller is way beyond the scrollable area, 
        * it needs to calculate a momentum that is closer to the boundaries 
        * to create the snap effect.
        * The mathematical function to get the destination is a simple ponderation 
        * of how much px to snap based on the current position and velocity.
        *
        * @params start {float} Minimum or maximum scrollable position
        * @params end {float} Wrapper size (how big the scroller wrapper is)
        * @params velocity {float} Current gesture velocity
        * @params current {float} Current scroller position
        * @method _computeSnap
        * @return {Object} An object with the destination and time where the scroller should snap to.
        * @protected
        */
        _computeSnap: function (start, end, velocity, current) {
            var destination = start + (end / 2) * (velocity / 8);
            return {
                destination : destination,
                time        : Math.abs((destination - current) / velocity)
            };
        },

        /**
        * Calculates the momentum for the current gesture.
        * If the destination of the momentum falls outside of the scrollable region,
        * it calculate the snapping point and the new momentum related to it.
        * @params current {float} Current scroller position
        * @params start {float} Start scroller position
        * @params duration {float} Time of the gesture
        * @params lowerMargin {integer} Maximum/minimum scrollable position
        * @params wrapperSize {integer} Size of the scroller wrapper
        * @method _momentum
        * @return {Object} An object with the destination and time where the scroller should scroll to.
        * @protected
        */
        _momentum: function (current, start, duration, lowerMargin, wrapperSize) {
            var velocity = this._getVelocity(current, start, duration),
                momentum = this._computeMomentum(velocity, current);

            // Beyond the scrollable area (bottom)
            if (momentum.destination < lowerMargin) {
                momentum = this._computeSnap(lowerMargin, wrapperSize, velocity, current);
                momentum.bounce = EASING.bounce;

            // Beyond the scrollable area (top)
            } else if (momentum.destination > 0) {
                momentum = this._computeSnap(0, wrapperSize, velocity, current);
                momentum.bounce = EASING.bounce;
            }

            return momentum;

        },

        /**
        * Stops the scroller inertia while scrolling and
        * establishes the current scroller position.
        *
        * @method _stopMomentum
        * @private
        */
        _stopMomentum: function () {
            var transform  = STYLES.transform,
                transition = STYLES.transition,
                style, matrix, x, y;

            // If we are using CSS transitions, we need to calculate the current 
            // position and reset the transition time.
            if (this.opts.useCSSTransition) {
                style  = w.getComputedStyle(this.scroller, null);
                if (SUPPORT.matrix) {
                    matrix = new STYLES.matrix(style[transform]);
                    this.scrollerStyle[transition] = '';
                    x = matrix.m41;
                    y = matrix.m42;
                } else {
                    matrix = style[transform].split(')')[0].split(', ');
                    x = +(matrix[12] || matrix[4]);
                    y = +(matrix[13] || matrix[5]);
                }
                this._translate(x, y);
            } else {
                // Otherwise we are using animation 
                // Cancel RAF
                CAF(this._rafReq);
            }
        },

        /**
        * Checks whether or not a custom reset position is needed.
        * Used to decouple `pullToRefresh` and `pullToLoadMore`
        * functionality as much as possible.
        *
        * @method _customResetPosition
        * @protected
        */
        _customResetPosition: function () {
            return this.opts.pullToRefresh || this.opts.pullToLoadMore;
        },

        /**
        * Checks whether or not a custom reset position is needed if the scroller is
        * outside the boundaries.
        * Used to decouple `pullToRefresh` and `pullToLoadMore`
        * functionality as much as possible.
        * @params time {integer} Default time for the scroll in case a snap is needed
        * @method _resetPosition
        * @protected
        */
        _resetPosition: function (time, forceReset) {
            time || (time = 0);

            var x = this.x,
                y = this.y,
                custom;

            // TODO: Find a way to decouple completely pullToRefresh and pullToLoadMore
            if (this._customResetPosition()) {
                if (this.opts.pullToRefresh && this.isTriggeredPTR()) {
                    custom = this.getResetPositionPTR();
                } else if (this.opts.pullToLoadMore && this.isTriggeredPTL()) {
                    custom = this.resetPositionPTL();
                }
            }

            if (custom) {
                y    = custom.y;
                x    = custom.x;
                time = custom.time || time;

            } else {
                // Outside boundaries top
                if (!this.hasScrollY || this.y > 0) {
                    y = 0;

                // Outside boundaries bottom
                } else if (this.y < this.maxScrollY) {
                    y = this.maxScrollY;
                }

                // Outsede left
                if (!this.hasScrollX || this.x > 0 ) {
                    x = 0;

                // Outside right
                } else if (this.x < this.maxScrollX) {
                    x = this.maxScrollX;
                }
            }

            if (y === this.y && x === this.x) {
                return false;
            }

            this._scrollTo(x, y, time, EASING.regular);
            return true;
        },

        /**
        * Sets the transition easing function property into the scroller node.
        * 
        * @params easing {integer} String representation of the CSS easing function
        * @method _transitionEasing
        * @private
        */
        _transitionEasing: function (easing) {
            this.scrollerStyle[STYLES.transitionTimingFunction] = easing;
        },

        /**
        * Sets the transition time property into the scroller node.
        * 
        * @params time {integer} Time or duration of the transition
        * @method _transitionTime
        * @private
        */
        _transitionTime: function (time) {
            time || (time = 0);
            this.scrollerStyle[STYLES.transitionDuration] = time + 'ms';
        },
        /**
        * Sets the current position in the CSS matrix3d transform.
        * We use matrix3d to force GPU acceleration and to allow plugins to easily
        * manipulate the matrix later on.
        * 
        * @params x {integer} Position for x coordinate 
        * @params y {integer} Position for y coordinate 
        * @method _translate
        * @protected
        */
        _translate: function (x, y) {
            this.scrollerStyle[STYLES.transform] = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,' + x +',' + y +', 0, 1)';
            this.x = x;
            this.y = y;
        },
        /**
        * Handler invoked by the transitionEnd event when the scroller reached an end
        * (this is used when `cssTransition:true`).
        * 
        * @params e {event} The transitionEnd event provided by the browser
        * @method _transitionEnd
        * @protected
        */
        _transitionEnd: function (e) {
            if (this.opts.useCSSTransition && e.target === this.scroller) {
                this._transitionTime();
                if (!this._resetPosition(this.opts.bounceTime)) {
                    this._isScrolling  = false;
                    this._fire('scrollEnd', ACTION_ANIM_END);
                }
            }
        },

        /**
        * Performs a custom animation given a function and
        * using `requestAnimationFrame` as a way to interpolate points in time.
        * The provided function must be continuous between [0,1] and images f(x)
        * should also be within [0, 1].
        * By default the scroller uses `CubicBezier` function curves with the parameters
        * defined in the EASING static variables.
        *
            * @params x {float} The x-position to scroll to
            * @params y {float} The y-position to scroll to
            * @params duration {float} The duration of the animation
            * @params easingFn {function} A function that images x values within [0,1] range
        * @method _animate
            * @private
        */
        _animate: function (x, y, duration, easingFn) {
            var self      = this,
                startX    = this.x,
                startY    = this.y,
                startTime = NOW(),
                deltaX    = x - startX,
                deltaY    = y - startY,
                destTime  = startTime + duration;

            function step () {
                var now = NOW(),
                    newX, newY, easing;

                if (now >= destTime) { // Finish the animation here
                    self._isAnimating = false;
                    self._rafReq = null;
                    self._translate(x, y);

                    // Snap back if we are out of boundaries
                    if (!self._resetPosition(self.opts.bounceTime)) {
                        self._fire('scrollEnd', ACTION_ANIM_END);
                        self._isScrolling = false;
                    }
                    return;
                }

                // `now` will the percentage of completion in the [0,1] range
                now    = ( now - startTime ) / duration;
                easing = easingFn(now); // Get f(x) => y position

                // Calculate new position based on the result of the function
                // and the start position.
                newX = deltaX * easing + startX;
                newY = deltaY * easing + startY;

                // Set the new position and notify changes
                self._translate(newX, newY);
                self._fire('scrollMove', ACTION_ANIM_MOVING, newX, newY);
                self._update();

                if (self._isAnimating) {
                    self._rafReq = RAF(step);
                }
            }

            this._isAnimating = true;
            step();
        },

        /**
        * Prepend an Array of elements into the scroller.
        * This function is overriden by SurfaceManager to allow a custom DOM manipulation.
        * @params items {HTMLElement[]} Array of items to insert in the scroller
        * @method _prependData
        * @protected
        */
        _prependData: function (items) {
            var docfrag = w.document.createDocumentFragment(),
                scrollerContainer = this.scroller,
                ptrContainer = scrollerContainer.firstChild;

            items.forEach(function (i) {
                docfrag.appendChild(i);
            });

            if (scrollerContainer.lastChild === ptrContainer) {
                scrollerContainer.appendChild(docfrag);
            } else {
                scrollerContainer.insertBefore(docfrag, ptrContainer.nextSibling);
            }
        },

        /**
        * Append an Array of elements into the scroller.
        * This function is overriden by SurfaceManager to allow a custom DOM manipulation.
        * @params items {HTMLElement[]} Array of items to insert in the scroller
        * @method _appendData
        * @protected
        */
        _appendData: function (items) {
            var docfrag           = w.document.createDocumentFragment(),
                scrollerContainer = this.scroller,
                i;

            for (i = 0 ; i < items.length; i++) {
                docfrag.appendChild(items[i]);
            }
            scrollerContainer.appendChild(docfrag);
        },
        /**
        * Scroll to a {x,y} position, given a specific time and easing function.
        * If `useCSSTransition: true`, the CSS changes are applied to the scroller.
        * Otherwise, an animation that interpolates
        * positions using `requestAnimationFrame` is triggered.
        *
        * @params x {float} The x-position to scroll to
        * @params y {float} The x-position to scroll to
        * @params time {float} Duration of the animation
        * @params easingFn {function} An easing function (if not provided, regular CubicBezier is used)
        * @method _scrollTo
        * @private
        */
        _scrollTo: function (x, y, time, easing) {
            easing || (easing = EASING.regular);

            if (!time || this.opts.useCSSTransition) {
                this._transitionEasing(easing.style);
                this._transitionTime(time);
                this._translate(x, y);
                this._update();
                if (!time) {
                    this._isScrolling = false;
                    this._fire(ACTION_GESTURE_END);
                }
            } else {
                this._animate(x, y, time, easing.fn);
            }
        },

        /**
        * Prepend an Array of elements into the scroller.
        * This function is overriden by SurfaceManager to allow a custom DOM manipulation.
        * @params eventType {string} Event name
        * @params fn {function} The callback to execute in response to the event
        * @params [context] {object} Override `this` object in callback
        * @method on
        * @public
        */
        on: function (eventType, fn, context) {
            var eventQueue = this._events[eventType] || (this._events[eventType] = []);
            eventQueue.push({
                fn      : fn,
                context : context
            });
        },

        /**
        * Update the scroller size.
        * Called automatically when the browser fires a `resize` or an `orientationChange` event.
        * @method resize
        * @public
        */
        resize: function () {
            var self = this;
            RAF(function () {
                // NOTE: Check the translate(0,0), we do it so when we get narrow width,
                // The scroll position may not exist anymore
                // We should be able to calculate the new (x,y) position
                self._translate(0,0);
                self._setSize();
            });
        },

        /**
        * Refreshes the scroller size and fires a private `_refresh` event so plugins can update themselves. 
        * This method is meant to be called when something in the DOM has changed to 
        * notify the scroller that it needs to recalculate its size and to set the correct internal state.
        * @method refresh
        * @public
        */
        refresh: function () {
            var self = this;
            if (!this._rafRefresh) {
                this._rafRefresh = RAF(function () { // debounce the refresh
                    self._fire('_refresh');
                    self._setSize();
                    self._rafRefresh = null;
                });
            }
        },
        /**
        * Adds a plugin to the scroller.
        *
        * A plugin can be a constructor function with its prototype or just a regular object. The scroller
        * merges these methods with its own (with the exception of a method called `init`).
        *
        * If an `init` method is provided, the scroller automatically calls it to
        * let the plugin initialize, attach custom events, and set the right state.
        * @params plugin {Function | Object} Plugin to inject into the scroller
        * @method plug
        * @public
        *
        * @example
            var scroller = new Scroller('#wrapper', {myCustomOption: 'yay!'});

            scroller.plug({
                init: function () {
                    this.on('_update', this._myPluginUpdate);
                },
                _myPluginUpdate: function () {
                    console.log(this.opts.myCustomOption + this.y);
                }
            });
            
        **/
        plug: function (plugin) {
            var ScrollerPlugin = typeof plugin === 'string' ? PLUGINS[plugin] : plugin,
                protoExtension =  ScrollerPlugin.prototype,
                whiteList      = ['init'],
                methodName;
                
            for (methodName in protoExtension) {
                if (whiteList.indexOf(methodName) === -1) {
                    this[methodName] = protoExtension[methodName];
                }
            }

            if (protoExtension.init) {
                protoExtension.init.call(this);
            }
        },

        /**
        * Scroll to a {x,y} position given a specific time and easing function.
        *
        * @params x {float} The x-position to scroll to
        * @params y {float} The y-position to scroll to
        * @params [time] {float} ms of the scroll animation
        * @params [easingFn] {function} An easing equation if time is set (default is the `easing` attribute)
        * @method scrollTo
        * @public
        */
        scrollTo: function (x, y, time) {
            if (this.x !== x || this.y !== y) {
                this._stopMomentum();

                //emulate gesture
                this.distX = x - this.x;
                this.distY = y - this.y;
                this._isScrolling = true;

                this._scrollTo.apply(this, arguments);
            }
        },

        /**
        * Scroll to the top of the scroller.
        *
        * @params [time] {float} ms of the scroll animation
        * @params [easingFn] {function} An easing equation if time is set (default is the `easing` attribute)
        * @method scrollToTop
        * @public
        */
        scrollToTop: function (time, easing) {
            this.scrollTo(0, 0, time, easing);
        },

        /**
        * Scroll to the bottom of the scroller.
        *
        * @params [time] {float} ms of the scroll animation
        * @params [easingFn] {function} An easing equation if time is set (default is the `easing` attribute)
        * @method scrollToBottom
        * @public
        */
        scrollToBottom: function (time, easing) {
            var x = this.maxScrollX,
                y = this.maxScrollY;
            if (this.scrollVertical) {
                x = 0;
            } else {
                y = 0;
            }

            this.scrollTo(x, y, time, easing);
        },
        /**
        * Prepend items to the scroller.
        *
        * It's recommended to use this method to add content to the scroller
        * instead of manually adding it to the DOM directly,
        * because the scroller will be able to optimize the rendering lifecycle depending on the configuration.
        *
        * @params data {HTMLElement | HTMLElement[] | String} Elements to prepend into the scroller
        * @method prependItems
        * @public
        */
        prependItems: function (data) {
            var parsedData = HELPERS.parseDOM(data);
            if (parsedData) {
                this._prependData(parsedData);
                this._setSize();
            }
        },
        /**
        * Append items to the scroller.
        *
        * It's recommended to use this method to add content to the scroller
        * instead of manually adding it to the DOM directly,
        * because the scroller will be able to optimize the rendering lifecycle depending on the configuration.
        *
        * @params data {HTMLElement | HTMLElement[] | String} Elements to append into the scroller
        * @method appendItems
        * @public
        */
        appendItems: function (data) {
            var parsedData = HELPERS.parseDOM(data);
            if (parsedData) {
                this._appendData(parsedData);
                this._setSize();
            }
        },
        /**
        * Destroy lifecycle method. Fires the `_destroy` event prior to invoking the destructor on itself.
        *
        * @method destroy
        * @public
        */
        destroy: function () {
            this._destroy();
            this._fire('destroy');
        }
    };

    w.Scroller = SCROLLER.constructor = Scroller;

}(window));