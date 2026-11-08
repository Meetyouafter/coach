import {useEffect, useRef} from 'react';
import {createPortal} from 'react-dom';

export function ConnectionLoader({label = 'Подключение…'}) {
  const screen = useRef(null);

  useEffect(() => {
    const root = screen.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const siblings = [...document.body.children].filter(element => element !== root && !['SCRIPT', 'STYLE'].includes(element.tagName));
    const previousInert = siblings.map(element => element.inert);
    siblings.forEach(element => {element.inert = true;});
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let animations = [];
    function animate() {
      animations.forEach(animation => animation.cancel());
      animations = [];
      if (motion.matches || !root.animate) return;
      const play = (element, frames, options) => animations.push(element.animate(frames, options));
      const loop = {duration: 2200, iterations: Infinity, easing: 'cubic-bezier(.76, 0, .24, 1)'};
      root.querySelectorAll('.connection-loader-motion > span').forEach((stripe, index) => {
        play(stripe, [
          {transform: 'translate3d(-85vw, 20vh, 0) scaleY(.4)', opacity: 0, offset: 0},
          {transform: 'translate3d(0, 0, 0) scaleY(1)', opacity: 1, offset: .28},
          {transform: 'translate3d(0, -3vh, 0) scaleY(.85)', opacity: 1, offset: .6},
          {transform: 'translate3d(85vw, -20vh, 0) scaleY(.4)', opacity: 0, offset: 1},
        ], {...loop, delay: index * 85});
      });
      root.querySelectorAll('.connection-loader-title-line > span').forEach((line, index) => {
        play(line, [
          {transform: 'translate3d(0, 115%, 0) rotate(4deg)', offset: 0},
          {transform: 'translate3d(0, 0, 0) rotate(0deg)', offset: .23},
          {transform: 'translate3d(0, 0, 0) rotate(0deg)', offset: .8},
          {transform: 'translate3d(0, -115%, 0) rotate(-4deg)', offset: 1},
        ], {...loop, delay: 180 + index * 100});
      });
      play(root.querySelector('.connection-loader-sweep'), [
        {transform: 'translate3d(-120%, 0, 0) skewX(-22deg)', opacity: 0},
        {opacity: .12, offset: .45},
        {transform: 'translate3d(180%, 0, 0) skewX(-22deg)', opacity: 0},
      ], {...loop, duration: 4400});
      play(root.querySelector('.connection-loader-track > span'), [
        {transform: 'translateX(-101%)'}, {transform: 'translateX(101%)'},
      ], {...loop, duration: 1100});
      play(root.querySelector('.connection-loader-orbit'), [
        {transform: 'rotate(-22deg) scale(1)'}, {transform: 'rotate(-14deg) scale(1.12)'}, {transform: 'rotate(-22deg) scale(1)'},
      ], {...loop, duration: 6600});
    }
    animate();
    motion.addEventListener('change', animate);
    return () => {
      animations.forEach(animation => animation.cancel());
      motion.removeEventListener('change', animate);
      document.body.style.overflow = previousOverflow;
      siblings.forEach((element, index) => {element.inert = previousInert[index];});
    };
  }, []);

  return createPortal(<div ref={screen} className="connection-loader" role="status">
    <span className="sr-only">{label}</span>
    <div className="connection-loader-art" aria-hidden="true">
      <div className="connection-loader-orbit" />
      <div className="connection-loader-sweep" />
      <div className="connection-loader-meta"><span>ЗАЛ / БЕГ<span className="connection-loader-edition">ЛИЧНЫЙ ЖУРНАЛ ТРЕНИРОВОК</span></span><span>НА СТАРТ <span className="connection-loader-arrow">↗</span></span></div>
      <div className="connection-loader-center">
      <div className="connection-loader-watermark">ДВИЖЕНИЕ</div>
      <div className="connection-loader-motion"><span /><span /><span /><span /><span /></div>
      <div className="connection-loader-title"><div className="connection-loader-title-line"><span>В ТВОЁМ</span></div><div className="connection-loader-title-line"><span>РИТМЕ.</span></div></div>
      </div>
      <div className="connection-loader-footer"><span>{label}</span><span className="connection-loader-track"><span /></span><span className="connection-loader-caption">ТВОЙ ТЕМП. ТВОЙ ПРОГРЕСС.</span></div>
    </div>
  </div>, document.body);
}
