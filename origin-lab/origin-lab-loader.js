(() => {
  const lab = document.querySelector('#origin-lab');
  if (!lab || location.protocol === 'file:' || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    import('./origin-lab.js').then(({mountLab}) => mountLab(lab)).catch(() => {
      lab.querySelector('.lab-stage-hint').textContent = '交互模块暂不可用。上方为六层架构示意。';
    });
  });
  observer.observe(lab.querySelector('.lab-stage'));
  window.addEventListener('pagehide', event => {
    if (!event.persisted) observer.disconnect();
  });
})();
