// File: util.js
var c = window.API_BASE;

function Util() {};

/*
	class manipulation functions
*/

Util.hasClass = function (el, className) {
  if (el.classList) return el.classList.contains(className);
  else return !!el.getAttribute('class').match(new RegExp('(\\s|^)' + className + '(\\s|$)'));
};

Util.addClass = function (el, className) {
  var classList = className.split(' ');
  if (el.classList) el.classList.add(classList[0]);
  else if (!Util.hasClass(el, classList[0])) el.setAttribute('class', el.getAttribute('class') + " " + classList[0]);
  if (classList.length > 1) Util.addClass(el, classList.slice(1).join(' '));
};

Util.removeClass = function (el, className) {
  var classList = className.split(' ');
  if (el.classList) el.classList.remove(classList[0]);
  else if (Util.hasClass(el, classList[0])) {
    var reg = new RegExp('(\\s|^)' + classList[0] + '(\\s|$)');
    el.setAttribute('class', el.getAttribute('class').replace(reg, ' '));
  }
  if (classList.length > 1) Util.removeClass(el, classList.slice(1).join(' '));
};

Util.toggleClass = function (el, className, bool) {
  if (bool) Util.addClass(el, className);
  else Util.removeClass(el, className);
};

Util.setAttributes = function (el, attrs) {
  for (var key in attrs) {
    el.setAttribute(key, attrs[key]);
  }
};

/*
  DOM manipulation
*/

Util.getChildrenByClassName = function (el, className) {
  var children = el.children,
    childrenByClass = [];
  for (var i = 0; i < el.children.length; i++) {
    if (Util.hasClass(el.children[i], className)) childrenByClass.push(el.children[i]);
  }
  return childrenByClass;
};

Util.is = function (elem, selector) {
  if (selector.nodeType) {
    return elem === selector;
  }

  var qa = (typeof (selector) === 'string' ? document.querySelectorAll(selector) : selector),
    length = qa.length,
    returnArr = [];

  while (length--) {
    if (qa[length] === elem) {
      return true;
    }
  }

  return false;
};

/*
	Animate height of an element
*/

Util.setHeight = function (start, to, element, duration, cb, timeFunction) {
  var change = to - start,
    currentTime = null;

  var animateHeight = function (timestamp) {
    if (!currentTime) currentTime = timestamp;
    var progress = timestamp - currentTime;
    if (progress > duration) progress = duration;
    var val = parseInt((progress / duration) * change + start);
    if (timeFunction) {
      val = Math[timeFunction](progress, start, to - start, duration);
    }
    element.style.height = val + "px";
    if (progress < duration) {
      window.requestAnimationFrame(animateHeight);
    } else {
      if (cb) cb();
    }
  };

  //set the height of the element before starting animation -> fix bug on Safari
  element.style.height = start + "px";
  window.requestAnimationFrame(animateHeight);
};

/*
	Smooth Scroll
*/

Util.scrollTo = function (final, duration, cb, scrollEl) {
  var element = scrollEl || window;
  var start = element.scrollTop || document.documentElement.scrollTop,
    currentTime = null;

  if (!scrollEl) start = window.scrollY || document.documentElement.scrollTop;

  var animateScroll = function (timestamp) {
    if (!currentTime) currentTime = timestamp;
    var progress = timestamp - currentTime;
    if (progress > duration) progress = duration;
    var val = Math.easeInOutQuad(progress, start, final - start, duration);
    element.scrollTo(0, val);
    if (progress < duration) {
      window.requestAnimationFrame(animateScroll);
    } else {
      cb && cb();
    }
  };

  window.requestAnimationFrame(animateScroll);
};

/*
  Focus utility classes
*/

//Move focus to an element
Util.moveFocus = function (element) {
  if (!element) element = document.getElementsByTagName("body")[0];
  element.focus();
  if (document.activeElement !== element) {
    element.setAttribute('tabindex', '-1');
    element.focus();
  }
};

/*
  Misc
*/

Util.getIndexInArray = function (array, el) {
  return Array.prototype.indexOf.call(array, el);
};

Util.cssSupports = function (property, value) {
  if ('CSS' in window) {
    return CSS.supports(property, value);
  } else {
    var jsProperty = property.replace(/-([a-z])/g, function (g) {
      return g[1].toUpperCase();
    });
    return jsProperty in document.body.style;
  }
};

// merge a set of user options into plugin defaults
// https://gomakethings.com/vanilla-javascript-version-of-jquery-extend/
Util.extend = function () {
  // Variables
  var extended = {};
  var deep = false;
  var i = 0;
  var length = arguments.length;

  // Check if a deep merge
  if (Object.prototype.toString.call(arguments[0]) === '[object Boolean]') {
    deep = arguments[0];
    i++;
  }

  // Merge the object into the extended object
  var merge = function (obj) {
    for (var prop in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, prop)) {
        // If deep merge and property is an object, merge properties
        if (deep && Object.prototype.toString.call(obj[prop]) === '[object Object]') {
          extended[prop] = extend(true, extended[prop], obj[prop]);
        } else {
          extended[prop] = obj[prop];
        }
      }
    }
  };

  // Loop through each object and conduct a merge
  for (; i < length; i++) {
    var obj = arguments[i];
    merge(obj);
  }

  return extended;
};

// Check if Reduced Motion is enabled
Util.osHasReducedMotion = function () {
  if (!window.matchMedia) return false;
  var matchMediaObj = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (matchMediaObj) return matchMediaObj.matches;
  return false; // return false if not supported
};

/*
	Polyfills
*/
//Closest() method
if (!Element.prototype.matches) {
  Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
}

if (!Element.prototype.closest) {
  Element.prototype.closest = function (s) {
    var el = this;
    if (!document.documentElement.contains(el)) return null;
    do {
      if (el.matches(s)) return el;
      el = el.parentElement || el.parentNode;
    } while (el !== null && el.nodeType === 1);
    return null;
  };
}

//Custom Event() constructor
if (typeof window.CustomEvent !== "function") {

  function CustomEvent(event, params) {
    params = params || {
      bubbles: false,
      cancelable: false,
      detail: undefined
    };
    var evt = document.createEvent('CustomEvent');
    evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
    return evt;
  }

  CustomEvent.prototype = window.Event.prototype;

  window.CustomEvent = CustomEvent;
}

/*
	Animation curves
*/
Math.easeInOutQuad = function (t, b, c, d) {
  t /= d / 2;
  if (t < 1) return c / 2 * t * t + b;
  t--;
  return -c / 2 * (t * (t - 2) - 1) + b;
};

Math.easeInQuart = function (t, b, c, d) {
  t /= d;
  return c * t * t * t * t + b;
};

Math.easeOutQuart = function (t, b, c, d) {
  t /= d;
  t--;
  return -c * (t * t * t * t - 1) + b;
};

Math.easeInOutQuart = function (t, b, c, d) {
  t /= d / 2;
  if (t < 1) return c / 2 * t * t * t * t + b;
  t -= 2;
  return -c / 2 * (t * t * t * t - 2) + b;
};

Math.easeOutElastic = function (t, b, c, d) {
  var s = 1.70158;
  var p = d * 0.7;
  var a = c;
  if (t == 0) return b;
  if ((t /= d) == 1) return b + c;
  if (!p) p = d * .3;
  if (a < Math.abs(c)) {
    a = c;
    var s = p / 4;
  } else var s = p / (2 * Math.PI) * Math.asin(c / a);
  return a * Math.pow(2, -10 * t) * Math.sin((t * d - s) * (2 * Math.PI) / p) + c + b;
};


/* JS Utility Classes */

// make focus ring visible only for keyboard navigation (i.e., tab key)
(function () {
  var focusTab = document.getElementsByClassName('js-tab-focus'),
    shouldInit = false,
    outlineStyle = false,
    eventDetected = false;

  function detectClick() {
    if (focusTab.length > 0) {
      resetFocusStyle(false);
      window.addEventListener('keydown', detectTab);
    }
    window.removeEventListener('mousedown', detectClick);
    outlineStyle = false;
    eventDetected = true;
  };

  function detectTab(event) {
    if (event.keyCode !== 9) return;
    resetFocusStyle(true);
    window.removeEventListener('keydown', detectTab);
    window.addEventListener('mousedown', detectClick);
    outlineStyle = true;
  };

  function resetFocusStyle(bool) {
    var outlineStyle = bool ? '' : 'none';
    for (var i = 0; i < focusTab.length; i++) {
      focusTab[i].style.setProperty('outline', outlineStyle);
    }
  };

  function initFocusTabs() {
    if (shouldInit) {
      if (eventDetected) resetFocusStyle(outlineStyle);
      return;
    }
    shouldInit = focusTab.length > 0;
    window.addEventListener('mousedown', detectClick);
  };

  initFocusTabs();
  window.addEventListener('initFocusTabs', initFocusTabs);
}());

function resetFocusTabsStyle() {
  window.dispatchEvent(new CustomEvent('initFocusTabs'));
};

//credits http://css-tricks.com/snippets/jquery/move-cursor-to-end-of-textarea-or-input/
function putCursorAtEnd(el) {
  if (el.setSelectionRange) {
    var len = el.value.length * 2;
    el.focus();
    el.setSelectionRange(len, len);
  } else {
    el.value = el.value;
  }
};
// File#: _2_modal


	var ModalSignin = function (element) {
		this.element = element;
		this.blocks = document.getElementsByClassName('js-modal-block');
		this.triggers = document.getElementsByClassName('js-modal-trigger');
		this.init();
	};

	ModalSignin.prototype.init = function () {
		var self = this;

		// open modal
		for (var i = 0; i < this.triggers.length; i++) {
			(function (i) {
				self.triggers[i].addEventListener('click', function (event) {
					if (event.target.hasAttribute('data-signin')) {
						// event.preventDefault();
						self.showSigninForm(event.target.getAttribute('data-signin'));
					}
				});
			})(i);
		}

		// close modal

		// TODO : add function to reset inputs after modal is closed

		this.element.addEventListener('click', function (event) {
			if (hasClass(event.target, 'js-modal')) {
				event.preventDefault();
				removeClass(self.element, 'is-visible');
			}
		});

		// close modal when clicking the esc keyboard button
		document.addEventListener('keyup', function (event) {
			if (event.key == 'Escape') {
				removeClass(self.element, 'is-visible');
				removeClass(self.blocks, 'is-selected');
			}
		});
	};

	ModalSignin.prototype.showSigninForm = function (type) {
		// show modal if not visible
		!hasClass(this.element, 'is-visible') &&
			addClass(this.element, 'is-visible');
		// show selected form
		for (var i = 0; i < this.blocks.length; i++) {
			this.blocks[i].getAttribute('data-type') == type
				? addClass(this.blocks[i], 'is-selected')
				: removeClass(this.blocks[i], 'is-selected');
		}
	};

	ModalSignin.prototype.toggleError = function (input, bool) {
		// used to show error messages in the form
		toggleClass(input, 'modal__input--has-error', bool);
		toggleClass(input.nextElementSibling, 'modal__error--is-visible', bool);
	};

	function initSigninModal() {
		var signinModal = document.getElementsByClassName('js-modal')[0];
		if (signinModal && signinModal.dataset.modalInit !== 'true') {
			signinModal.dataset.modalInit = 'true';
			new ModalSignin(signinModal);
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initSigninModal);
	} else {
		initSigninModal();
	}

	window.addEventListener('portal-components-ready', initSigninModal);

//class manipulations - needed if classList is not supported
function hasClass(el, className) {
	if (el.classList) return el.classList.contains(className);
	else
		return !!el.className.match(new RegExp('(\\s|^)' + className + '(\\s|$)'));
}

function addClass(el, className) {
	var classList = className.split(' ');
	if (el.classList) el.classList.add(classList[0]);
	else if (!hasClass(el, classList[0])) el.className += ' ' + classList[0];
	if (classList.length > 1) addClass(el, classList.slice(1).join(' '));
}

function removeClass(el, className) {
	var classList = className.split(' ');
	if (el.classList) el.classList.remove(classList[0]);
	else if (hasClass(el, classList[0])) {
		var reg = new RegExp('(\\s|^)' + classList[0] + '(\\s|$)');
		el.className = el.className.replace(reg, ' ');
	}
	if (classList.length > 1) removeClass(el, classList.slice(1).join(' '));
}

function toggleClass(el, className, bool) {
	if (bool) addClass(el, className);
	else removeClass(el, className);
}

// File#: _1_password

(function () {
  var Password = function (element) {
    this.element = element;
    this.password = this.element.getElementsByClassName('js-password__input')[0];
    this.visibilityBtn = this.element.getElementsByClassName('js-password__btn')[0];
    this.visibilityClass = 'password--text-is-visible';
    this.initPassword();
  };

  Password.prototype.initPassword = function () {
    var self = this;
    
    //listen to the click on the password btn
    this.visibilityBtn.addEventListener('click', function (event) {
      //if password is in focus -> do nothing if user presses Enter
      if (document.activeElement === self.password) return;
      event.preventDefault();
      self.togglePasswordVisibility();
    });
  };

  Password.prototype.togglePasswordVisibility = function () {
    var makeVisible = !Util.hasClass(this.element, this.visibilityClass);
    //change element class
    Util.toggleClass(this.element, this.visibilityClass, makeVisible);
    //change input type
    (makeVisible) ? this.password.setAttribute('type', 'text'): this.password.setAttribute('type', 'password');
  };

  function initPasswordToggles() {
    var passwords = document.getElementsByClassName('js-password');
    for (var i = 0; i < passwords.length; i++) {
      (function (el) {
        if (!el.dataset.pwInit) {
          el.dataset.pwInit = '1';
          new Password(el);
        }
      })(passwords[i]);
    }
  }

  initPasswordToggles();
  window.addEventListener('portal-components-ready', initPasswordToggles);
}());
// File#: _2_menu

(function () {
  if (window.__portalMenuBound) return;
  window.__portalMenuBound = true;

  function closeAllMenus() {
    $('.js-nav-trigger').removeClass('is-clicked');
    $('.side-nav').removeClass('is-visible');
    $('.item--has-children').children('a').removeClass('submenu-open').next('.sub-menu').delay(300).slideUp();
  }

  $(document).on('click.portalMenu', '.js-nav-trigger', function (event) {
    event.preventDefault();
    $('.js-nav-trigger').toggleClass('is-clicked');
    $('.side-nav').toggleClass('is-visible');
    $('.item--has-children').children('a').removeClass('submenu-open').next('.sub-menu').delay(300).slideUp();
  });

  $(document).on('click.portalMenu', '.side-nav .item--has-children > a', function (event) {
    event.preventDefault();
    $(this)
      .toggleClass('submenu-open')
      .next('.sub-menu')
      .slideToggle(300)
      .end()
      .parent('.item--has-children')
      .siblings('.item--has-children')
      .children('a')
      .removeClass('submenu-open')
      .next('.sub-menu')
      .slideUp(300);
  });

  $('body').on('click.portalMenu', function (event) {
    if ($(event.target).closest('.side-nav, .js-nav-trigger').length === 0) {
      closeAllMenus();
    }
  });

  $('body').on('keydown.portalMenu', function (event) {
    if (event.key === 'Escape') {
      closeAllMenus();
    }
  });

  window.addEventListener('portal-components-ready', function () {
    $('.item--has-children').children('a').removeClass('submenu-open').next('.sub-menu').hide();
    if (!window.NAV_CHEVRONS) $('.side-nav').addClass('no-chevrons');
    if (window.SUB_MENU_LOWERCASE) $('.side-nav').addClass('submenu-lowercase');
    setup();
  });
})();

// ── JWT auto-refresh (every 14 min to beat the 15 min expiry) ─────────────────
(function () {
  var REFRESH_INTERVAL = 14 * 60 * 1000; // 14 minutes
  var refreshTimer = null;

  async function refreshJWT() {
    if (localStorage.getItem('loggedIn') !== 'true') return;
    try {
      var avatarRaw = localStorage.getItem('avatar');
      var avatar = avatarRaw ? JSON.parse(avatarRaw) : null;
      var refreshToken = avatar && (avatar.refreshToken || avatar.RefreshToken);
      if (!refreshToken) return;

      var res = await fetch((window.apiUrl || '') + '/api/Avatar/refresh-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refreshToken })
      });
      if (!res.ok) return;
      var data = await res.json();
      var newToken = data.jwtToken || data.token || (data.result && (data.result.jwtToken || data.result.token));
      var newRefresh = data.refreshToken || (data.result && data.result.refreshToken);
      if (newToken && avatar) {
        avatar.jwtToken = newToken;
        avatar.token    = newToken;
        if (newRefresh) avatar.refreshToken = newRefresh;
        localStorage.setItem('avatar', JSON.stringify(avatar));
        // Push new token into all SDK clients immediately
        if (window.oasisClient)  window.oasisClient.setToken(newToken);
        if (window.starClient)   window.starClient.setToken(newToken);
        if (window.aiClient)     window.aiClient.setToken(newToken);
        console.log('[OPORTAL] JWT refreshed successfully.');
        return true;
      }
      return false;
    } catch (e) {
      console.warn('[OPORTAL] JWT refresh failed:', e);
      return false;
    }
  }

  function startRefresh() {
    if (refreshTimer) return;
    refreshTimer = setInterval(refreshJWT, REFRESH_INTERVAL);
  }

  function stopRefresh() {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  // Start when logged in, stop on logout.
  // Also refresh immediately on page load so a stale JWT from a previous session
  // is replaced before any API calls are made (JWT expires in 15 min).
  document.addEventListener('DOMContentLoaded', function () {
    // Show avatar menu immediately from static HTML — don't wait for portal-components-ready
    if (typeof setup === 'function') setup();

    if (localStorage.getItem('loggedIn') === 'true') {
      if (!isJwtValid()) {
        // Expose a promise other modules (e.g. nft-modal) can await before
        // making API calls, so they don't fire with an expired token.
        window.jwtReadyPromise = refreshJWT().then(function (ok) {
          if (ok && typeof setup === 'function') setup();
          return ok;
        });
      } else {
        window.jwtReadyPromise = Promise.resolve(true);
      }
      startRefresh();
    } else {
      window.jwtReadyPromise = Promise.resolve(false);
    }
  });
  window.addEventListener('oasis-login',  startRefresh);
  window.addEventListener('oasis-logout', stopRefresh);

  // Expose so login/logout flow can trigger directly
  window.startJWTRefresh = startRefresh;
  window.stopJWTRefresh  = stopRefresh;
})();

function isJwtValid() {
  try {
    var avatarRaw = localStorage.getItem('avatar');
    if (!avatarRaw || avatarRaw === 'undefined') return false;
    var avatar = JSON.parse(avatarRaw);
    var token = avatar && (avatar.jwtToken || avatar.JwtToken || avatar.token || avatar.Token);
    if (!token) return false;
    var parts = token.split('.');
    if (parts.length !== 3) {
      // Not a standard JWT — treat as opaque bearer token, assume valid if non-empty
      console.log('[JWT] token is not a 3-part JWT (parts=' + parts.length + ', len=' + token.length + ') — treating as valid opaque token');
      return true;
    }
    // base64url → base64: replace - with + and _ with /, then pad to multiple of 4
    var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var payload = JSON.parse(atob(b64));
    if (!payload.exp) return true; // no expiry claim — assume valid
    var valid = payload.exp * 1000 > Date.now();
    console.log('[JWT] exp=' + payload.exp + ', now=' + Math.floor(Date.now()/1000) + ', valid=' + valid);
    return valid;
  } catch (e) {
    console.log('[JWT] isJwtValid error:', e.message);
    return false;
  }
}

function setup() {
console.log('[SETUP] setup() called');
const avatarRaw = localStorage.getItem('avatar');
if (avatarRaw && avatarRaw !== 'undefined') {
    user = JSON.parse(avatarRaw);
}

  var loginDiv = document.querySelector('[data-display="loggedIn"]')
  var avatarDiv = document.querySelector('.nav__item--account')
  var icon = document.getElementsByClassName('avatar')[0]
  console.log('[SETUP] loggedIn=', localStorage.getItem('loggedIn'), '| avatarDiv=', !!avatarDiv, '| icon=', !!icon);

  /*if logged in, hide guest links*/
  if (localStorage.getItem('loggedIn') === "true"){
    var guest_links = document.getElementById('guest-links')
    var username = document.getElementById("username")
    if (guest_links) guest_links.style.display = "none"
    if (avatarDiv) avatarDiv.classList.add('loggedin')

    if (username)
      username.innerHTML = user.username;//username

    icon.src='assets/img/loggedin.png'

    // If the stored JWT is already locally expired, trigger refresh/re-login
    // before firing dashboard API calls (avoids mass 401s on page load).
    console.log('[SETUP] isJwtValid()=', typeof isJwtValid === 'function' ? isJwtValid() : 'fn missing');
    if (typeof isJwtValid === 'function' && !isJwtValid()) {
      console.log('[SETUP] JWT invalid — calling handleUnauthorized and returning early');
      if (typeof window.handleUnauthorized === 'function') {
        window.handleUnauthorized();
        return;
      }
    }

    console.log('[SETUP] showDashboard available?', typeof window.showDashboard === 'function');
    console.log('[SETUP] #dashboard element exists?', !!document.getElementById('dashboard'));
    if (typeof window.showDashboard === 'function') window.showDashboard();
    console.log('[SETUP] showDashboard() called');
  }

  /* Do not show drop down*/
  else{
    // loginDiv.style.display = 'none'
    if (avatarDiv.classList.contains('loggedin')) {
      avatarDiv.classList.remove('loggedin')
    }
    icon.src='assets/img/loggedout.png'
    if (typeof window.hideDashboard === 'function') window.hideDashboard();
  }
}

window.addEventListener('avatarUpdated', function (e) {
  var p = e.detail;
  if (!p) return;
  var newName = p.username || p.userName || p.UserName;
  if (!newName) return;
  var el = document.getElementById('username');
  if (el) el.innerHTML = newName;
});

function addAuthPopup(login, msg, e) {
	// Get and remove previous pop ups
	var prev = document.getElementsByClassName('alert')[0]

	if (prev)prev.remove()
	var formId;
	var type;
	var alert = msg.message || msg.title;

	if (msg.status === 400 || (msg.result != null && msg.result.isError)) {
		type = 'error'
		alert = msg.result ? msg.result.message : 'Unknown error';
	}
	else {
		type = 'success'

    if (login)
    {
      var avatarProfile = msg.result && msg.result.result ? msg.result.result : msg.result;
      // Avatar.AvatarId is a serialisation wrapper around base.Id — they must always match.
      // Normalise both so downstream code can rely on either field being correct.
      var _canonicalId = avatarProfile && (avatarProfile.avatarId || avatarProfile.AvatarId || avatarProfile.id || avatarProfile.Id || '');
      if (_canonicalId && avatarProfile) {
        avatarProfile.id       = _canonicalId;
        avatarProfile.Id       = _canonicalId;
        avatarProfile.avatarId = _canonicalId;
        avatarProfile.AvatarId = _canonicalId;
      }
      console.log('[AUTH] avatarProfile keys:', avatarProfile ? Object.keys(avatarProfile) : 'null');
      var _loginTok = avatarProfile && (avatarProfile.jwtToken || avatarProfile.JwtToken || avatarProfile.token || avatarProfile.Token || '');
      console.log('[AUTH] JWT token found in login response?', !!_loginTok, '| length:', _loginTok ? _loginTok.length : 0);
      localStorage.setItem('avatar', JSON.stringify(avatarProfile));
      localStorage.setItem('loggedIn', true)
      console.log('[AUTH] Saved to localStorage. loggedIn=', localStorage.getItem('loggedIn'));
      user = avatarProfile;
      window.user = avatarProfile;
      // Inject JWT into SDK clients so authenticated calls work immediately
      if (_loginTok) {
        if (window.oasisClient) window.oasisClient.setToken(_loginTok);
        if (window.starClient)  window.starClient.setToken(_loginTok);
        if (window.aiClient)    window.aiClient.setToken(_loginTok);
      }
      if (typeof window.startJWTRefresh === 'function') window.startJWTRefresh();
      if (typeof setup === 'function') {
        setup();
      }
      alert = 'Beam In Successful';
      setTimeout(function () {
        var activeModal = document.querySelector('.js-modal.is-visible');
        if (activeModal) {
          removeClass(activeModal, 'is-visible');
        }
        var selectedBlocks = document.querySelectorAll('.js-modal-block.is-selected');
        selectedBlocks.forEach(function (block) {
          removeClass(block, 'is-selected');
        });
      }, 900);
    }
    else
        alert = msg.result.message;
	}


  // console.log("login-error=", document.getElementById('login-error'));
  // console.log("login-error.style=", document.getElementById('login-error').style);
  // console.log("login-error.style.display=", document.getElementById('login-error').style.display);

  // document.getElementById('login-error').innerHTML = alert;
  // document.getElementById('login-error').style.display = 'block';

  var errorId = login ? "login-error" : "signup-error";
  var divError = document.getElementById(errorId);


  if (divError === null) 
  {
	  login ? formId = 'login-form' : formId = 'signup-form'
		// Create popup element
		let target = document.getElementById(formId)
		var div = document.createElement('div');
		div.id = errorId;
    div.classList.add('alert')
		div.classList.add(type)
    div.style.marginTop = '10px'
		div.innerHTML = alert;
		//target.parentNode.insertBefore(div, target);
    //target.insertAdjacentElement('afterend', div); 
    target.appendChild(div);
  }
  else
  {
      divError.innerHTML = alert;
      //divError.classList.remove('success');
      //divError.classList.add('error');
    }
		//console.log(type)
		if (e && typeof e.preventDefault === 'function') e.preventDefault();
}

function extractAvatarData(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.avatar && typeof payload.avatar === 'object') return payload.avatar;
  if (payload.result && typeof payload.result === 'object') {
    if (payload.result.result && typeof payload.result.result === 'object') return payload.result.result;
    if (payload.result.avatar && typeof payload.result.avatar === 'object') return payload.result.avatar;
    return payload.result;
  }
  if (payload.data && typeof payload.data === 'object') return payload.data;
  return payload;
}

function getAvatarDetailUrls(profile) {
  var urls = [];
  var email = profile && (profile.email || profile.Email || profile.emailAddress || profile.EmailAddress);
  var username = profile && (profile.username || profile.userName || profile.UserName);
  var id = profile && (profile.id || profile.Id || profile.avatarId || profile.AvatarId);

  if (email) {
    urls.push(`${API_BASE}/api/avatar/get-avatar-detail-by-email/${encodeURIComponent(email)}`);
  }
  if (username) {
    urls.push(`${API_BASE}/api/avatar/get-avatar-detail-by-username/${encodeURIComponent(username)}`);
  }
  if (id) {
    urls.push(`${API_BASE}/api/avatar/get-avatar-detail-by-id/${encodeURIComponent(id)}`);
  }

  return urls.filter(function (url, index, list) {
    return url && list.indexOf(url) === index;
  });
}

async function hydrateLoggedInAvatar(profile) {
  var avatar = profile || {};
  var token = avatar.jwtToken || avatar.token || '';
  if (!token) {
    return avatar;
  }

  try {
    const urls = getAvatarDetailUrls(avatar);
    for (let i = 0; i < urls.length; i++) {
      const response = await fetch(urls[i], {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      console.log("Fetched avatar detail:", data);
      const fullAvatar = extractAvatarData(data);
      if (!fullAvatar || typeof fullAvatar !== 'object') {
        continue;
      }

      const merged = Object.assign({}, avatar, fullAvatar);
      // Always preserve the original JWT — detail endpoints don't re-issue tokens
      merged.jwtToken = merged.jwtToken || avatar.jwtToken;
      merged.JwtToken = merged.JwtToken || avatar.JwtToken;
      merged.token    = merged.token    || avatar.token;
      merged.Token    = merged.Token    || avatar.Token;
      console.log("Merged avatar data:", merged);
      localStorage.setItem('avatar', JSON.stringify(merged));
      user = merged;
      window.user = merged;
      return merged;
    }
  } catch (error) {
    return avatar;
  }

  return avatar;
}

function onLogin() {
	// Get button and change it when pressed
  // console.log("login-error=", document.getElementById('login-error'));
  // console.log("login-error.style=", document.getElementById('login-error').style);
  // console.log("login-error.style.display=", document.getElementById('login-error').style.display);
  // document.getElementById('login-error').style.display = 'none';

	const submitBtn = document.getElementById('login-submit')
	submitBtn.innerHTML = 'Beaming in... <img width="20px" src="assets/img/loading.gif"/>'
	submitBtn.disabled = true
	let n = {
		//email: document.getElementById('login-email').value,
    username: document.getElementById('login-email').value,
		password: document.getElementById('login-password').value,
	};
	(async () =>
  {
    console.log('[LOGIN] Sending authenticate request to', `${API_BASE}/api/avatar/authenticate`);
		const e = await fetch(
			`${API_BASE}/api/avatar/authenticate`,
			{
				method: 'POST',
				body: JSON.stringify(n),
				headers: { 'Content-Type': 'application/json' },
			}
		);
		// Re-enable button after request
		submitBtn.innerHTML = 'Submit'
		submitBtn.disabled = false
    console.log('[LOGIN] authenticate response status:', e.status);
		var t;
		if (200 === e.status) {
      t = await e.json();
      console.log('[LOGIN] authenticate response body:', JSON.stringify(t).slice(0, 500));
      addAuthPopup(true, t, e);
      var extracted = extractAvatarData(t);
      console.log('[LOGIN] extractAvatarData result:', extracted ? JSON.stringify(extracted).slice(0, 300) : 'null');
      var hydrated = await hydrateLoggedInAvatar(extracted);
      console.log('[LOGIN] hydrateLoggedInAvatar result:', hydrated ? JSON.stringify(hydrated).slice(0, 300) : 'null');
      console.log('[LOGIN] localStorage.loggedIn after hydrate:', localStorage.getItem('loggedIn'));
      var savedAvatar = localStorage.getItem('avatar');
      var parsed = savedAvatar ? JSON.parse(savedAvatar) : null;
      console.log('[LOGIN] avatar in localStorage after hydrate — jwtToken present?', !!(parsed && (parsed.jwtToken || parsed.JwtToken || parsed.token || parsed.Token)));
      console.log('[LOGIN] isJwtValid():', typeof isJwtValid === 'function' ? isJwtValid() : 'n/a');
      console.log('[LOGIN] calling setup()...');
      if (typeof setup === 'function') setup();
      console.log('[LOGIN] setup() returned');
    } else {
      t = await e.json();
      submitBtn.classList.add('error');
      addAuthPopup(true, t, e);
    }
	})();
}

async function onLogout() {
	const avatarRaw = localStorage.getItem('avatar');

  if (avatarRaw && avatarRaw !== 'undefined') 
  {
      user = JSON.parse(avatarRaw);
      console.log("user=", user);
      const body = {token: user.jwtToken};
      const loading = document.getElementById('loading');

      loading.classList.add('modal')
      loading.classList.add('is-visible')
      loading.innerHTML = '<img src="assets/img/loading.gif"/>'
      console.log(body)

      const e = await fetch(`${API_BASE}/api/avatar/revoke-token`, 
      {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json'
        }
      })
  }
  
  if (typeof window.stopJWTRefresh === 'function') window.stopJWTRefresh();
  if (typeof window.hideDashboard === 'function') window.hideDashboard();
	localStorage.removeItem('avatar')
	localStorage.setItem('loggedIn', false)
	window.location.reload()
}

// Opens the Beam In (login) modal without a full page reload.
window.openLoginModal = function () {
  var modal = document.querySelector('.js-modal');
  var blocks = document.querySelectorAll('.js-modal-block');
  if (!modal) { window.location.reload(); return; }
  blocks.forEach(function (b) {
    b.classList.toggle('is-selected', b.getAttribute('data-type') === 'login');
  });
  modal.classList.add('is-visible');
};

// Called by any modal that receives a 401 / Unauthorized response.
// Tries to silently refresh the JWT first; only clears the session if that fails.
window.handleUnauthorized = async function () {
  try {
    var refreshed = await refreshJWT();
    if (refreshed) {
      console.log('[OPORTAL] Token silently renewed after 401.');
      // Reload dashboard so cards pick up the fresh token
      if (typeof window.showDashboard === 'function') window.showDashboard();
      return;
    }
  } catch (e) {}
  // Refresh failed — session is truly dead, clear it and show Beam In
  if (typeof window.stopJWTRefresh === 'function') window.stopJWTRefresh();
  if (typeof window.hideDashboard === 'function') window.hideDashboard();
  localStorage.removeItem('avatar');
  localStorage.setItem('loggedIn', 'false');
  // Close any open modal then show login
  var openModal = document.querySelector('.js-modal.is-visible');
  if (openModal) openModal.classList.remove('is-visible');
  window.openLoginModal();
};

function setSignupError(message) {
  var signUpError = document.getElementById("signup-error");
  if (signUpError == null) {
    var target = document.getElementById('signup-form');
    if (!target) return;
    var div = document.createElement('div');
    div.id = "signup-error";
    div.classList.add('alert');
    div.classList.add('error');
    div.style.marginTop = '10px';
    div.innerHTML = message;
    target.appendChild(div);
    return;
  }

  signUpError.style.display = 'block';
  signUpError.innerHTML = message;
}

function clearSignupError() {
  var signUpError = document.getElementById("signup-error");
  if (signUpError != null) {
    signUpError.style.display = 'none';
    signUpError.innerHTML = "";
  }
}

function validateSignupPasswords(showOnMismatch) {
  var passwordEl = document.getElementById("signup-password");
  var confirmPasswordEl = document.getElementById("confirm-signup-password");

  if (!passwordEl || !confirmPasswordEl) {
    return true;
  }

  var password = passwordEl.value;
  var confirmPassword = confirmPasswordEl.value;

  if (!password || !confirmPassword) {
    confirmPasswordEl.classList.remove('form-control--error');
    confirmPasswordEl.removeAttribute('aria-invalid');
    clearSignupError();
    return true;
  }

  if (password !== confirmPassword) {
    confirmPasswordEl.classList.add('form-control--error');
    confirmPasswordEl.setAttribute('aria-invalid', 'true');
    if (showOnMismatch) {
      setSignupError("Passwords do not match.");
    } else {
      clearSignupError();
    }
    return false;
  }

  confirmPasswordEl.classList.remove('form-control--error');
  confirmPasswordEl.removeAttribute('aria-invalid');
  clearSignupError();
  return true;
}

function initSignupPasswordValidation() {
  var passwordEl = document.getElementById("signup-password");
  var confirmPasswordEl = document.getElementById("confirm-signup-password");

  if (!passwordEl || !confirmPasswordEl) {
    return;
  }

  var handleSignupPasswordInput = function () {
    validateSignupPasswords(false);
  };

  passwordEl.addEventListener('input', handleSignupPasswordInput);
  confirmPasswordEl.addEventListener('input', handleSignupPasswordInput);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSignupPasswordValidation);
} else {
  initSignupPasswordValidation();
}

function onSignup() {
	// Get button and change it when pressed

  var acceptTerms = document.getElementById("acceptTerms");

  if (acceptTerms && !acceptTerms.checked) 
  { 
    setSignupError("You must accept the terms and conditions.");

    return;
  }

  if (!validateSignupPasswords(true)) {

    document.getElementById("confirm-signup-password").focus();
    return;
  }

  clearSignupError();

  const submitBtn = document.getElementById('signup-submit')
	submitBtn.innerHTML = 'Signing Up... <img width="20px" style="margin-left: 5px;" src="assets/img/loading.gif"/>'
	submitBtn.disabled = true
	let n = {
		firstName: document.getElementById('signup-first-name').value,
    lastName: document.getElementById('signup-last-name').value,
    username: document.getElementById('signup-username').value,
    //username: document.getElementById('signup-email').value,
    email: document.getElementById('signup-email').value,
		password: document.getElementById('signup-password').value,
		confirmPassword: document.getElementById('confirm-signup-password').value,
		acceptTerms: !0,
		avatarType: 'User',
	};
	(async () => {
		const e = await fetch(
			`${API_BASE}/api/avatar/register`,
			{
				method: 'POST',
				body: JSON.stringify(n),
				headers: { 'Content-Type': 'application/json' },
			}
		);
		submitBtn.innerHTML = 'Submit'
		submitBtn.disabled = false

		e.status !== 200 ? submitBtn.classList.add('error'):null

		var t;
		200 === e.status
			? ((t = await e.json()), addAuthPopup(false, t, e))
			: ((t = await e.json()), addAuthPopup(false, t, e))//,
			//window.location.reload();
	})();
}

function accountDropdown() {
	// Check if device is mobile...
	if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && localStorage.getItem('loggedIn') === "true") {
		// Get dropdown list
		var dropdown = document.getElementsByClassName('nav__sub-list')[0]
		if (dropdown.classList.contains('nav__sub-list--clicked')) {
			dropdown.classList.remove('nav__sub-list--clicked')
			return
		}
		dropdown.classList.add('nav__sub-list--clicked')
	} 
}
