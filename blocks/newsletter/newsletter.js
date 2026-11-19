/*
 * Newsletter block: RWJF "Stay informed" signup (two steps, like rwjf.org).
 * Authoring (key-value): heading, intro, endpoint, siteKey, successHeading.
 * Endpoint "mock" runs the whole flow without network calls.
 */
import { toClassName } from '../../scripts/aem.js';

const CONFIG = {
  recaptchaAction: 'email_subscription',
  alreadySubscribedHeading: 'Email address already subscribed',
  contentTypes: [
    { value: 'advances', label: 'Advances Newsletter', description: 'Be informed with our twice a month newsletter updating you with relevant news and research around a Culture of Health, as well as the latest funding opportunities.' },
    { value: 'funding', label: 'Funding Alerts', description: 'Get funded by RWJF: Receive notifications when new funding opportunities are released.' },
    {
      value: 'policyBulletin',
      label: 'Federal Policy Bulletin',
      description: 'Receive monthly updates on RWJF-sponsored research that informs many robust health policy debates on Capitol Hill, covering topics like health equity, improving access to quality healthcare, equitable housing, and more.',
      tooltip: 'This area examines RWJF-sponsored research that identifies policies, laws, and other regulatory tools that can be leveraged to build a Culture of Health. As well, you’ll find research that examines the impact that existing policies, programs, and partnerships have on our country’s health, well-being, and equity.',
    },
    { value: 'rel', label: 'Research, Evaluation, and Learning', description: 'Shop talk for researchers. This monthly newsletter covers research news and opportunities from the Robert Wood Johnson Foundation.' },
    { value: 'ct', label: 'Communications Toolbox', description: 'Communications expedite action. Get periodic research and expert insights on the best ways to communicate so we can spread what works.' },
    { value: 'otherCommunications', label: 'There’s more...', description: 'Sometimes we have news, announcements or opportunities that don’t quite fit the subscription parameters above. If you’re interested, we’ll send you this information under “There’s more...”. *If you’ve indicated you are an EU resident, we will only send these communications if you intentionally check this box.' },
  ],
  professions: [
    { value: 'activistAdvocate', label: 'Activist/Advocate' },
    { value: 'grantMaker', label: 'Grant maker' },
    { value: 'jobSeeker', label: 'Job Seeker' },
    { value: 'media', label: 'Media' },
    { value: 'staffer', label: 'Policymaker or Staffer' },
    { value: 'publicHealth', label: 'Public Health or Healthcare Professional' },
    { value: 'academicResearcher', label: 'Researcher' },
    { value: 'student', label: 'Student' },
    { value: 'Other', label: 'Other' },
  ],
  areas: [
    { value: 'birthJustice', label: 'Birth justice/Maternal Health' },
    { value: 'caregiving', label: 'Caregiving' },
    { value: 'communityPower', label: 'Community Power' },
    { value: 'disabality', label: 'Disability Rights/Disability Justice' },
    { value: 'econInclusion', label: 'Economic inclusion' },
    { value: 'entertainment', label: 'Entertainment' },
    { value: 'foodSystem', label: 'Food Systems' },
    { value: 'futureOfHealth', label: 'Future of Health' },
    { value: 'globalLearning', label: 'Global Learning' },
    { value: 'healthcarePolicy', label: 'Health Policy' },
    { value: 'impactInvesting', label: 'Impact Investing' },
    { value: 'leadershipPrograms', label: 'Leadership and Leadership Programs' },
    { value: 'physicalEnvironment', label: 'Physical and Built Environment' },
    { value: 'research', label: 'Research' },
  ],
  messages: {
    email: 'Valid email is required in format yourname@example.com',
    firstNameRequired: 'First Name is required',
    firstNameInvalid: 'Please enter a valid First Name',
    lastNameRequired: 'Last Name is required',
    lastNameInvalid: 'Please enter a valid Last Name',
    tooLong: 'The text entered exceeds the maximum length',
    org: 'Organization is required',
    grantee: 'Please indicate if you are an RWJF Grantee (past or present)',
    eu: 'Please indicate if you are a European Union resident',
    contentTypes: 'Please select at least one subscription',
    other: 'Please describe your profession or pursuit',
    network: 'We couldn’t reach the subscription service. Please try again later.',
    captcha: 'Verification failed. Please try again.',
    generic: 'Something went wrong. Please try again.',
    step2: 'Please complete your details below.',
    loading: 'Sending…',
    mock: 'Test mode: no subscription is created.',
  },
};

const NAME_PATTERN = /^[\p{L}][\p{L}\p{M}' .-]*$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
let uid = 0;

/* ---------------------------------------------------------------- config */
function readConfig(block) {
  const config = {};
  [...block.children].forEach((row) => {
    const [keyCell, valueCell] = row.children;
    if (!keyCell || !valueCell) return;
    config[toClassName(keyCell.textContent)] = valueCell;
  });
  const text = (key) => (config[key]?.textContent || '').trim();
  return {
    heading: text('heading') || 'Stay informed',
    introHtml: (() => {
      const html = config.intro?.innerHTML.trim() || '';
      return html && !/^<(p|ul|ol|h[1-6]|div)[\s>]/i.test(html) ? `<p>${html}</p>` : html;
    })(),
    endpoint: text('endpoint'),
    siteKey: text('sitekey') || text('site-key'),
    successHeading: text('successheading') || text('success-heading') || 'Subscribed!',
  };
}

/* ---------------------------------------------------------------- recaptcha (loaded on demand) */
let recaptchaReady;
function loadRecaptcha(siteKey) {
  if (!siteKey) return Promise.reject(new Error('missing site key'));
  if (!recaptchaReady) {
    recaptchaReady = new Promise((resolve, reject) => {
      if (window.grecaptcha?.execute) {
        window.grecaptcha.ready(() => resolve(window.grecaptcha));
        return;
      }
      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
      script.async = true;
      script.onload = () => window.grecaptcha.ready(() => resolve(window.grecaptcha));
      script.onerror = () => {
        recaptchaReady = null;
        reject(new Error('recaptcha failed to load'));
      };
      document.head.append(script);
    });
  }
  return recaptchaReady;
}

async function recaptchaToken(siteKey) {
  const grecaptcha = await loadRecaptcha(siteKey);
  return grecaptcha.execute(siteKey, { action: CONFIG.recaptchaAction });
}

/* ---------------------------------------------------------------- requests */
function mockResponse(body) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const email = (body.email || '').toLowerCase();
      if (body.action === 'check') {
        resolve(email === 'subscribed@example.com'
          ? { status: 'subscribed', message: 'Email address already subscribed. Please check your inbox to manage your subscriptions.', showMore: false }
          : { status: 'newUser', message: '', showMore: true });
      } else {
        resolve(email === 'error@example.com'
          ? { status: 'error', message: 'Your subscription could not be saved (mock error).' }
          : { status: 'success', message: 'Thank you. You are now subscribed.' });
      }
    }, 600);
  });
}

class RequestError extends Error {
  constructor(kind, response) {
    super(kind);
    this.kind = kind;
    this.response = response;
  }
}

async function send(endpoint, body) {
  if (endpoint === 'mock') return mockResponse(body);
  let url;
  try {
    url = new URL(endpoint, window.location.href);
  } catch {
    throw new RequestError('network');
  }
  // CORS "simple request": POST + text/plain body and no other headers, so the browser sends no
  // OPTIONS preflight; no cookies. The servlet path is excluded from the AEM CSRF filter.
  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(body),
      credentials: 'omit',
    });
  } catch {
    throw new RequestError('network');
  }
  let json = null;
  try {
    json = await resp.json();
  } catch {
    json = null;
  }
  if (!json) throw new RequestError(resp.ok ? 'generic' : 'network');
  return json;
}

/* ---------------------------------------------------------------- markup helpers */
function nextId(prefix) {
  uid += 1;
  return `newsletter-${prefix}-${uid}`;
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (v === false || v === null || v === undefined) return;
    if (k === 'className') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v === true ? '' : v);
  });
  children.flat().filter(Boolean).forEach((c) => node.append(c));
  return node;
}

function errorText(id) {
  return el('p', { className: 'newsletter-error', id, hidden: true });
}

function textField({
  name, label, type = 'text', autocomplete, required = true, maxlength,
}) {
  const id = nextId(name);
  const errId = `${id}-error`;
  const input = el('input', {
    id, name, type, autocomplete, maxlength, required, 'aria-required': required ? 'true' : null, 'aria-describedby': errId,
  });
  return {
    input,
    error: null,
    node: el(
      'div',
      { className: 'newsletter-field' },
      el('label', { for: id, text: `${label}${required ? ' (required)' : ''}` }),
      input,
      errorText(errId),
    ),
  };
}

function choiceFieldset({
  name, legend, type, options, required, className, describe = false,
}) {
  const errId = `${nextId(name)}-error`;
  const fieldset = el('fieldset', { className: `newsletter-choices ${className || ''}`.trim(), 'aria-describedby': errId });
  if (required) fieldset.setAttribute('aria-required', 'true');
  fieldset.append(el('legend', { text: `${legend}${required ? ' (required)' : ''}` }));
  const list = el('div', { className: 'newsletter-options' });
  options.forEach((opt) => {
    const id = nextId(`${name}-${opt.value}`);
    const descId = opt.description ? `${id}-desc` : null;
    const input = el('input', {
      id, type, name, value: opt.value, 'aria-describedby': descId,
    });
    const label = el('label', { for: id }, input, el('span', { className: 'newsletter-option-label', text: opt.label }));
    const option = el('div', { className: 'newsletter-option' }, label);
    if (opt.tooltip) {
      const tipId = `${id}-tip`;
      const tipButton = el('button', {
        type: 'button', className: 'newsletter-tip-button', 'aria-expanded': 'false', 'aria-controls': tipId,
      }, el('span', { className: 'visually-hidden', text: `More about ${opt.label}` }));
      const tip = el('p', {
        className: 'newsletter-tip', id: tipId, hidden: true, text: opt.tooltip,
      });
      tipButton.addEventListener('click', () => {
        const open = tipButton.getAttribute('aria-expanded') !== 'true';
        tipButton.setAttribute('aria-expanded', String(open));
        tip.hidden = !open;
      });
      label.after(tipButton);
      option.append(tip);
    }
    if (describe && opt.description) option.append(el('p', { className: 'newsletter-option-desc', id: descId, text: opt.description }));
    list.append(option);
  });
  fieldset.append(list, errorText(errId));
  return fieldset;
}

function setError(target, message) {
  const errId = target.getAttribute('aria-describedby')?.split(' ').find((id) => id.endsWith('error'));
  const err = errId ? document.getElementById(errId) : null;
  if (err) {
    err.textContent = message || '';
    err.hidden = !message;
  }
  if (message) target.setAttribute('aria-invalid', 'true');
  else target.removeAttribute('aria-invalid');
  target.closest('.newsletter-field, .newsletter-choices')?.classList.toggle('has-error', !!message);
  return !message;
}

function setLoading(button, loading) {
  button.disabled = loading;
  button.classList.toggle('is-loading', loading);
  if (loading) button.setAttribute('aria-busy', 'true');
  else button.removeAttribute('aria-busy');
}

/* ---------------------------------------------------------------- block */
export default function decorate(block) {
  const config = readConfig(block);
  const isMock = config.endpoint === 'mock';
  block.textContent = '';

  const form = el('form', { className: 'newsletter-form', novalidate: true });
  // screen-reader announcements only (loading, step 2, errors)
  const status = el('div', { className: 'newsletter-status visually-hidden', role: 'status', 'aria-live': 'polite' });

  // band: intro + step 1
  const headingId = nextId('heading');
  const intro = el('div', { className: 'newsletter-intro' }, el('h2', { id: headingId, text: config.heading }));
  if (config.introHtml) intro.append(el('div', { className: 'newsletter-intro-text' }));
  if (config.introHtml) intro.querySelector('.newsletter-intro-text').innerHTML = config.introHtml;
  form.setAttribute('aria-labelledby', headingId);

  const email = textField({
    name: 'email', label: 'Email address', type: 'email', autocomplete: 'email',
  });
  const continueBtn = el('button', { type: 'submit', className: 'newsletter-button newsletter-continue' }, el('span', { text: 'Continue' }), el('span', { className: 'newsletter-spinner', 'aria-hidden': 'true' }));
  const step1Error = el('p', { className: 'newsletter-form-error', hidden: true });
  const step1 = el(
    'div',
    { className: 'newsletter-step1' },
    email.node,
    el('div', { className: 'newsletter-actions' }, continueBtn),
    step1Error,
    isMock ? el('p', { className: 'newsletter-mock-note', text: CONFIG.messages.mock }) : null,
  );
  const band = el('div', { className: 'newsletter-band' }, intro, step1);

  // step 2
  const first = textField({
    name: 'firstName', label: 'First name', autocomplete: 'given-name', maxlength: 35,
  });
  const last = textField({
    name: 'lastName', label: 'Last name', autocomplete: 'family-name', maxlength: 35,
  });
  const org = textField({ name: 'org', label: 'Organization', autocomplete: 'organization' });
  const yesNo = [{ value: 'No', label: 'No' }, { value: 'Yes', label: 'Yes' }];
  const grantee = choiceFieldset({
    name: 'rwjfGrantee', legend: 'Are you an RWJF grantee (past or present)?', type: 'radio', options: yesNo, required: true, className: 'newsletter-yesno',
  });
  const eu = choiceFieldset({
    name: 'euResident', legend: 'Are you a European Union resident?', type: 'radio', options: yesNo, required: true, className: 'newsletter-yesno',
  });
  const types = choiceFieldset({
    name: 'subscriptionOptions', legend: 'Tell us what type of content you want to receive. Select at least one', type: 'checkbox', options: CONFIG.contentTypes, required: true, className: 'newsletter-types', describe: true,
  });
  const profession = choiceFieldset({
    name: 'extraCategory', legend: 'Which profession or pursuit best describes you?', type: 'radio', options: CONFIG.professions, className: 'newsletter-columns',
  });
  const otherId = nextId('otherText');
  const otherErrId = `${otherId}-error`;
  const otherInput = el('input', {
    id: otherId, name: 'otherText', type: 'text', maxlength: 100, disabled: true, 'aria-describedby': otherErrId,
  });
  const otherOption = [...profession.querySelectorAll('.newsletter-option')].pop();
  otherOption.classList.add('newsletter-option-other');
  otherOption.append(el('label', { for: otherId, className: 'visually-hidden', text: 'Other profession or pursuit' }), otherInput, errorText(otherErrId));
  const areas = choiceFieldset({
    name: 'areasOfIntrest', legend: 'Area(s) of interest', type: 'checkbox', options: CONFIG.areas, className: 'newsletter-columns',
  });
  const submitBtn = el('button', { type: 'submit', className: 'newsletter-button newsletter-submit' }, el('span', { text: 'Submit' }), el('span', { className: 'newsletter-spinner', 'aria-hidden': 'true' }));
  const step2Error = el('p', { className: 'newsletter-form-error', hidden: true });
  const step2 = el(
    'div',
    { className: 'newsletter-step2', hidden: true },
    el('div', { className: 'newsletter-names' }, first.node, last.node),
    org.node,
    grantee,
    eu,
    types,
    profession,
    areas,
    el('div', { className: 'newsletter-actions' }, submitBtn),
    step2Error,
  );

  form.append(band, step2, status);
  block.append(form);

  /* helpers */
  let announceTimer;
  const announce = (message) => {
    clearTimeout(announceTimer);
    status.textContent = '';
    announceTimer = setTimeout(() => { status.textContent = message; }, 50);
  };
  const showFormError = (target, message) => {
    target.textContent = message;
    target.hidden = !message;
    if (message) announce(message);
  };
  const checkedValues = (name) => [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((i) => i.value);
  const radioValue = (name) => form.querySelector(`input[name="${name}"]:checked`)?.value || '';
  // the result replaces the whole band content (heading, intro and form); focus moves to it, so
  // screen readers read it once and it is not repeated in the status region
  const showResult = (heading, message) => {
    const result = el(
      'div',
      { className: 'newsletter-result', tabindex: '-1' },
      el('h2', { id: headingId, text: heading }),
      message ? el('p', { text: message }) : null,
    );
    band.replaceChildren(result);
    band.classList.remove('is-expanded');
    band.classList.add('has-result');
    step2.remove();
    clearTimeout(announceTimer);
    status.textContent = '';
    result.focus();
  };

  /* reCAPTCHA only after the visitor shows intent */
  const warmRecaptcha = () => { loadRecaptcha(config.siteKey).catch(() => {}); };
  email.input.addEventListener('focus', warmRecaptcha, { once: true });
  continueBtn.addEventListener('click', warmRecaptcha, { once: true });

  /* "Other" profession */
  profession.addEventListener('change', () => {
    const isOther = radioValue('extraCategory') === 'Other';
    otherInput.disabled = !isOther;
    if (isOther) otherInput.focus();
    else {
      otherInput.value = '';
      setError(otherInput, '');
    }
  });

  /* live re-validation after a first error */
  form.addEventListener('input', (e) => {
    if (e.target.getAttribute('aria-invalid') === 'true') setError(e.target, '');
  });
  form.addEventListener('change', (e) => {
    const fieldset = e.target.closest('fieldset');
    if (fieldset?.getAttribute('aria-invalid') === 'true') setError(fieldset, '');
  });

  const validateEmail = () => setError(
    email.input,
    EMAIL_PATTERN.test(email.input.value.trim()) ? '' : CONFIG.messages.email,
  );
  const validateName = (field, required, invalid) => {
    const value = field.input.value.trim();
    let message = '';
    if (!value) message = required;
    else if (value.length > 35) message = CONFIG.messages.tooLong;
    else if (!NAME_PATTERN.test(value)) message = invalid;
    return setError(field.input, message);
  };
  const validateStep2 = () => {
    const checks = [
      validateName(first, CONFIG.messages.firstNameRequired, CONFIG.messages.firstNameInvalid),
      validateName(last, CONFIG.messages.lastNameRequired, CONFIG.messages.lastNameInvalid),
      setError(org.input, org.input.value.trim() ? '' : CONFIG.messages.org),
      setError(grantee, radioValue('rwjfGrantee') ? '' : CONFIG.messages.grantee),
      setError(eu, radioValue('euResident') ? '' : CONFIG.messages.eu),
      setError(types, checkedValues('subscriptionOptions').length ? '' : CONFIG.messages.contentTypes),
      setError(otherInput, radioValue('extraCategory') === 'Other' && !otherInput.value.trim() ? CONFIG.messages.other : ''),
    ];
    if (checks.every(Boolean)) return true;
    const firstInvalid = form.querySelector('.newsletter-step2 [aria-invalid="true"]');
    (firstInvalid?.matches('fieldset') ? firstInvalid.querySelector('input') : firstInvalid)?.focus();
    return false;
  };

  const messageFor = (err) => {
    if (err?.response?.message) return err.response.message;
    if (err?.kind === 'captcha') return CONFIG.messages.captcha;
    if (err?.kind === 'network' || err instanceof TypeError) return CONFIG.messages.network;
    return CONFIG.messages.generic;
  };

  /* step 1: check */
  const check = async () => {
    showFormError(step1Error, '');
    if (!validateEmail()) {
      email.input.focus();
      return;
    }
    setLoading(continueBtn, true);
    announce(CONFIG.messages.loading);
    try {
      const response = await send(config.endpoint, { action: 'check', email: email.input.value.trim(), emailTrackingCode: '' });
      if (response.showMore === true) {
        step2.hidden = false;
        band.classList.add('is-expanded');
        email.input.readOnly = true;
        continueBtn.closest('.newsletter-actions').remove();
        first.input.focus();
        announce(CONFIG.messages.step2);
      } else if (response.message) {
        showResult(CONFIG.alreadySubscribedHeading, response.message);
      } else {
        throw new RequestError('generic', response);
      }
    } catch (err) {
      showFormError(step1Error, messageFor(err));
    } finally {
      if (continueBtn.isConnected) setLoading(continueBtn, false);
    }
  };

  /* step 2: add */
  const add = async () => {
    showFormError(step2Error, '');
    if (!validateStep2()) return;
    setLoading(submitBtn, true);
    announce(CONFIG.messages.loading);
    try {
      let captchaToken;
      try {
        captchaToken = await recaptchaToken(config.siteKey);
      } catch (e) {
        if (!isMock) throw new RequestError('captcha');
        captchaToken = 'mock-token';
      }
      const isOther = radioValue('extraCategory') === 'Other';
      const response = await send(config.endpoint, {
        action: 'add',
        email: email.input.value.trim(),
        firstName: first.input.value.trim(),
        lastName: last.input.value.trim(),
        org: org.input.value.trim(),
        rwjfGrantee: radioValue('rwjfGrantee'),
        euResident: radioValue('euResident'),
        subscriptionOptions: checkedValues('subscriptionOptions'),
        areasOfIntrest: checkedValues('areasOfIntrest'),
        extraCategory: radioValue('extraCategory'),
        otherText: isOther ? otherInput.value.trim() : '',
        captchaToken,
        emailTrackingCode: '',
      });
      if (response.status !== 'success') throw new RequestError('status', response);
      showResult(config.successHeading, response.message);
    } catch (err) {
      setLoading(submitBtn, false);
      showFormError(step2Error, messageFor(err));
      submitBtn.focus();
    } finally {
      if (submitBtn.isConnected) setLoading(submitBtn, false);
    }
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (step2.hidden) check();
    else add();
  });
}
