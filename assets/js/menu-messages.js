(function () {
  function setup() {
    var user;
    var avatarRaw = localStorage.getItem('avatar');
    if (avatarRaw && avatarRaw !== 'undefined') {
      try {
        user = JSON.parse(avatarRaw);
      } catch (error) {
        user = null;
      }
    }

    var avatarDiv = document.querySelector('.nav__item--account');
    var icon = document.getElementsByClassName('avatar')[0];

    if (!avatarDiv || !icon) return;

    if (localStorage.getItem('loggedIn') === 'true') {
      var guestLinks = document.getElementById('guest-links');
      var username = document.getElementById('username');

      if (guestLinks) {
        guestLinks.style.display = 'none';
      }
      avatarDiv.classList.add('loggedin');

      if (username && user && user.username) {
        username.innerHTML = user.username;
      }

      icon.src = 'assets/img/loggedin.png';
    } else {
      if (avatarDiv.classList.contains('loggedin')) {
        avatarDiv.classList.remove('loggedin');
      }
      icon.src = 'assets/img/loggedout.png';
    }
  }

  function showMenuMessage(title, message) {
    var panel = document.getElementById('menu-message');
    if (!panel) return;

    panel.innerHTML = '<h3>' + title + '</h3><p>' + message + '</p>';
    panel.hidden = false;
    panel.classList.add('menu-message--show');

    clearTimeout(window.__menuMessageTimer);
    window.__menuMessageTimer = setTimeout(function () {
      panel.classList.remove('menu-message--show');
      panel.hidden = true;
    }, 2800);
  }

  function showCheckAPIMessage() {
    if (localStorage.getItem('loggedIn') === 'true') {
      showMenuMessage('Check API', 'This area is available after sign in. Select a linked action from the menu to continue.');
    } else {
      showMenuMessage('Sign in required', 'Please beam in first to use this area.');
    }
  }

  function showComingSoonMessage() {
    showMenuMessage('Coming soon', 'This feature is planned for a future update.');
  }

  function showSTARMessage() {
    showMenuMessage('STAR / OApp tools', 'These developer tools are part of the WEB5 STAR stack and will be opened from the Developer menu.');
  }

  function showOurWorldMessage() {
    showMenuMessage('Our World', 'This section is tied to the Our World / map experience and will open there when the flow is ready.');
  }

  function goToAvatar(event) {
    if (event) event.preventDefault();
    if (localStorage.getItem('loggedIn') === 'true') {
      window.location.href = event && event.currentTarget ? event.currentTarget.getAttribute('data-avatar-route') : '/avatar/';
      return;
    }
    showCheckAPIMessage();
  }

  window.showMenuMessage = showMenuMessage;
  window.showCheckAPIMessage = showCheckAPIMessage;
  window.showComingSoonMessage = showComingSoonMessage;
  window.showSTARMessage = showSTARMessage;
  window.showOurWorldMessage = showOurWorldMessage;
  window.goToAvatar = goToAvatar;
  window.setup = setup;

  function init() {
    setup();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
