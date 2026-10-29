'use strict';
document.querySelectorAll('label.import[role="button"]').forEach(label => {
  label.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); label.querySelector('input').click(); } };
});
start();
