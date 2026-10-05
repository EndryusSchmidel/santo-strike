const menuButton = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');

const revealItems = [...document.querySelectorAll('[data-reveal]')];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (revealItems.length && 'IntersectionObserver' in window && !reduceMotion) {
  document.documentElement.classList.add('has-reveal');
  revealItems.forEach((item) => item.classList.add('reveal-pending'));

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.remove('reveal-pending');
      entry.target.classList.add('reveal-in');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -35px 0px' });

  revealItems.forEach((item) => revealObserver.observe(item));
}

menuButton?.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  menuButton.setAttribute('aria-label', isOpen ? 'Abrir menu' : 'Fechar menu');
  mainNav?.classList.toggle('is-open', !isOpen);
});

mainNav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    menuButton?.setAttribute('aria-expanded', 'false');
    menuButton?.setAttribute('aria-label', 'Abrir menu');
    mainNav.classList.remove('is-open');
  });
});

const galleryDialog = document.querySelector('.lightbox');
const galleryDialogImage = galleryDialog?.querySelector('img');

document.querySelectorAll('.gallery-item').forEach((item) => {
  item.addEventListener('click', () => {
    if (!galleryDialog || !galleryDialogImage) return;
    const thumbnail = item.querySelector('img');
    galleryDialogImage.src = item.dataset.full || thumbnail?.src || '';
    galleryDialogImage.alt = thumbnail?.alt || '';
    galleryDialog.showModal();
  });
});

galleryDialog?.querySelector('.lightbox-close')?.addEventListener('click', () => galleryDialog.close());
galleryDialog?.addEventListener('click', (event) => {
  if (event.target === galleryDialog) galleryDialog.close();
});
galleryDialog?.addEventListener('close', () => {
  if (galleryDialogImage) galleryDialogImage.removeAttribute('src');
});

const saoPauloWeekday = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  timeZone: 'America/Sao_Paulo',
}).format(new Date());
const weekdayIndex = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[saoPauloWeekday];
document.querySelector(`.hours-list [data-day="${weekdayIndex}"]`)?.classList.add('today');

const yearLabel = document.querySelector('#year');
if (yearLabel) yearLabel.textContent = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric' }).format(new Date());

const announcement = document.querySelector('.announcement');
const businessStatus = document.querySelector('#business-status');
const weeklySchedule = new Map([...document.querySelectorAll('.hours-list [data-day]')].map((row) => {
  const hoursText = row.querySelector('b')?.textContent.trim() ?? '';
  const match = hoursText.match(/(\d{1,2}):(\d{2})\s*[—–-]\s*(\d{1,2}):(\d{2})/);
  if (!match) return [Number(row.dataset.day), null];

  return [Number(row.dataset.day), {
    opens: Number(match[1]) * 60 + Number(match[2]),
    closes: Number(match[3]) * 60 + Number(match[4]),
  }];
}));
const specialClosedDates = new Set((announcement?.dataset.closedDates ?? '')
  .split(',')
  .map((date) => date.trim())
  .filter(Boolean));
const weekdayNames = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const saoPauloClock = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo',
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function isClosedByException(dateKey, weekday, dayOfMonth) {
  const isThirdSunday = weekday === 0 && dayOfMonth >= 15 && dayOfMonth <= 21;
  return isThirdSunday || specialClosedDates.has(dateKey);
}

function formatOpeningTime(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return minute ? `${hour}h${String(minute).padStart(2, '0')}` : `${hour}h`;
}

function findNextOpeningDate(year, month, day) {
  const todayUtc = Date.UTC(year, month - 1, day);
  for (let offset = 1; offset <= 7; offset += 1) {
    const date = new Date(todayUtc + offset * 24 * 60 * 60 * 1000);
    const weekday = date.getUTCDay();
    const schedule = weeklySchedule.get(weekday);
    const dateKey = [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, '0'), String(date.getUTCDate()).padStart(2, '0')].join('-');
    if (schedule && !isClosedByException(dateKey, weekday, date.getUTCDate())) {
      return { date, offset, schedule };
    }
  }
  return null;
}

function updateBusinessStatus() {
  if (!announcement || !businessStatus || !weeklySchedule.size) return;

  const setStatus = (message, isOpen) => {
    if (businessStatus.textContent !== message) businessStatus.textContent = message;
    announcement.classList.toggle('is-open', isOpen);
    announcement.classList.toggle('is-closed', !isOpen);
  };

  const parts = Object.fromEntries(saoPauloClock.formatToParts(new Date()).map(({ type, value }) => [type, value]));
  const weekday = weekdayNames[parts.weekday];
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const minutesNow = Number(parts.hour) * 60 + Number(parts.minute);
  const todayKey = [year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
  const todaySchedule = weeklySchedule.get(weekday);
  const closedToday = !todaySchedule || isClosedByException(todayKey, weekday, day);

  if (!closedToday && minutesNow >= todaySchedule.opens && minutesNow < todaySchedule.closes) {
    setStatus(`Aberto agora · fecha às ${formatOpeningTime(todaySchedule.closes)}`, true);
    return;
  }

  const nextOpening = findNextOpeningDate(year, month, day);
  let nextOpeningLabel = 'em breve';
  if (nextOpening) {
    const dayLabel = nextOpening.offset === 1
      ? 'amanhã'
      : new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(nextOpening.date).replace('-feira', '');
    nextOpeningLabel = `${dayLabel} às ${formatOpeningTime(nextOpening.schedule.opens)}`;
  }

  if (!closedToday && minutesNow < todaySchedule.opens) {
    setStatus(`Abrimos hoje às ${formatOpeningTime(todaySchedule.opens)}`, false);
  } else {
    setStatus(`Fechado · abrimos ${nextOpeningLabel}`, false);
  }
}

updateBusinessStatus();
window.setInterval(updateBusinessStatus, 60_000);

const faqItems = [...document.querySelectorAll('.faq-item')];
if (faqItems.length && !reduceMotion && typeof Element.prototype.animate === 'function') {
  document.documentElement.classList.add('has-animated-faq');

  faqItems.forEach((item) => {
    const summary = item.querySelector('summary');
    const answer = item.querySelector('.faq-answer');
    if (!summary || !answer) return;

    answer.style.height = item.open ? 'auto' : '0px';
    answer.style.opacity = item.open ? '1' : '0';
    let isAnimating = false;

    summary.addEventListener('click', (event) => {
      event.preventDefault();
      if (isAnimating) return;

      isAnimating = true;
      const opening = !item.open;
      if (opening) item.open = true;

      const fromHeight = opening ? 0 : answer.getBoundingClientRect().height;
      const toHeight = opening ? answer.scrollHeight : 0;
      const animation = answer.animate([
        { height: `${fromHeight}px`, opacity: opening ? 0 : 1 },
        { height: `${toHeight}px`, opacity: opening ? 1 : 0 },
      ], {
        duration: 360,
        easing: 'cubic-bezier(.22, .7, .2, 1)',
      });

      animation.onfinish = () => {
        if (opening) {
          answer.style.height = 'auto';
          answer.style.opacity = '1';
        } else {
          item.open = false;
          answer.style.height = '0px';
          answer.style.opacity = '0';
        }
        isAnimating = false;
      };
    });
  });
}
