// IntersectionObserver 包装：卡片进入视口时触发回调
// rootMargin 50px 是为了卡片快到视口前就提前预热请求
export function createIntersectObserver(onEnter) {
  return new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) onEnter(entry.target);
      });
    },
    {
      root: null,
      rootMargin: '50px 0px',
      threshold: 0.1,
    }
  );
}
