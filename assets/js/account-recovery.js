(function () {
  var API_BASE = window.apiUrl;

  function getById(id) {
    return document.getElementById(id);
  }

  function getToken() {
    var params = new URLSearchParams(window.location.search);
    return params.get('token') || '';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setPanel(panel, state, title, message) {
    if (!panel) return;

    var badgeClass = state ? 'status-card status-card--' + state : 'status-card';
    var messageHtml = escapeHtml(message || '');
    if (state === 'loading') {
      messageHtml =
        '<span class="status-loading-line">' +
        '<span class="status-loading-text">' + escapeHtml(message || '') + '</span>' +
        '<span class="status-spinner" aria-hidden="true"></span>' +
        '</span>';
    }
    panel.className = badgeClass;
    panel.innerHTML =
      '<h2>' + escapeHtml(title || '') + '</h2>' +
      '<p>' + messageHtml + '</p>';
  }

  async function readResponse(response) {
    try {
      return await response.json();
    } catch (error) {
      try {
        return { message: await response.text() };
      } catch (innerError) {
        return { message: 'The server returned an unexpected response.' };
      }
    }
  }

  async function postJson(path, body) {
    return fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  function getMessage(payload) {
    if (!payload) return '';
    return payload.message || payload.title || payload.error || '';
  }

  function getButton(form) {
    return form ? form.querySelector('button[type="submit"], input[type="submit"], button') : null;
  }

  function setButtonState(button, text, disabled) {
    if (!button) return;
    if (button.tagName === 'INPUT') {
      button.value = text;
    } else {
      button.textContent = text;
    }
    button.disabled = !!disabled;
  }

  function setForgotMsg(type, text) {
    var el = getById('forgot-msg');
    if (!el) return;
    el.className = 'forgot-status visible forgot-status--' + type;
    el.textContent = text;
  }

  function bindForgotPasswordForm() {
    var form = getById('forgot-form');
    if (!form || form.dataset.recoveryBound === 'true') return;
    form.dataset.recoveryBound = 'true';

    form.addEventListener('submit', async function (event) {
      event.preventDefault();

      var emailInput = getById('forgot-email') || getById('forgotEmail');
      var email = emailInput ? emailInput.value.trim() : '';
      var button = getButton(form);

      if (!email) {
        setForgotMsg('error', 'Please enter your email address.');
        return;
      }

      setForgotMsg('loading', 'Sending…');
      setButtonState(button, 'Sending...', true);

      var response = await postJson('/api/avatar/forgot-password', { email: email });
      var data = await readResponse(response);

      if (response.ok) {
        setForgotMsg('success', 'Reset link sent — check your inbox.');
      } else {
        setForgotMsg('error', getMessage(data) || 'Something went wrong.');
      }

      setButtonState(button, 'Send reset link', false);
    });
  }

  function bindResetPasswordForm() {
    var form = getById('reset-form');
    if (!form || form.dataset.recoveryBound === 'true') return;
    form.dataset.recoveryBound = 'true';

    form.addEventListener('submit', async function (event) {
      event.preventDefault();

      var token = getToken();
      var newPasswordInput = getById('newPassword');
      var confirmPasswordInput = getById('confirmNewPassword') || getById('confirmNewPasword');
      var statusPanel = getById('reset-status');
      var button = getButton(form);
      var newPassword = newPasswordInput ? newPasswordInput.value : '';
      var confirmNewPassword = confirmPasswordInput ? confirmPasswordInput.value : '';

      if (!token) {
        setPanel(statusPanel, 'error', 'Missing token', 'The password reset link is missing its token.');
        return;
      }

      if (!newPassword || !confirmNewPassword) {
        setPanel(statusPanel, 'error', 'Password required', 'Enter and confirm your new password.');
        return;
      }

      if (newPassword !== confirmNewPassword) {
        setPanel(statusPanel, 'error', 'Passwords do not match', 'The new password and confirmation must match.');
        return;
      }

      setPanel(statusPanel, 'loading', 'Resetting password', 'Updating password...');
      setButtonState(button, 'Resetting...', true);

      var response = await postJson('/api/avatar/reset-password', {
        token: token,
        newPassword: newPassword,
        confirmNewPassword: confirmNewPassword,
      });
      var data = await readResponse(response);

      if (response.ok) {
        setPanel(
          statusPanel,
          'success',
          'Password updated',
          getMessage(data) || 'Password updated successfully. Click Return to portal when you are ready.'
        );
      } else {
        setPanel(statusPanel, 'error', 'Reset failed', getMessage(data) || 'Something went wrong.');
      }

      setButtonState(button, 'Reset Password', false);
    });
  }

  async function runVerification() {
    var panel = getById('verify-status');
    if (!panel || panel.dataset.recoveryStarted === 'true') return;
    panel.dataset.recoveryStarted = 'true';

    var token = getToken();

    if (!token) {
      setPanel(panel, 'error', 'Missing token', 'The verification link is missing its token.');
      return;
    }

    setPanel(panel, 'loading', 'Verifying email', 'Verifying token...');

    var response = await postJson('/api/avatar/verify-email', { token: token });
    var data = await readResponse(response);

    if (response.ok) {
      setPanel(
        panel,
        'success',
        'Email verified',
        getMessage(data) || 'Email verified successfully. Click Return to portal when you are ready.'
      );
    } else {
      setPanel(panel, 'error', 'Verification failed', getMessage(data) || 'Something went wrong.');
    }
  }

  function init() {
    bindForgotPasswordForm();
    bindResetPasswordForm();
    runVerification();
  }

  function initWhenReady() {
    init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('portal-components-ready', initWhenReady);
})();
