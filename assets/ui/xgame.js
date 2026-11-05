
document.querySelectorAll('.x-game').forEach(function(card){
  card.addEventListener('pointermove', function(e){
    var r=card.getBoundingClientRect();
    card.style.setProperty('--mx',((e.clientX-r.left)/r.width*100)+'%');
    card.style.setProperty('--my',((e.clientY-r.top)/r.height*100)+'%');
  });
});
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.style.opacity=1;e.target.style.transform='none';io.unobserve(e.target);}})},{threshold:.12});
document.querySelectorAll('.x-game,.x-stat,.x-sec-head').forEach(function(el,i){el.style.opacity=0;el.style.transform='translateY(18px)';el.style.transition='opacity .38s '+(i*40)+'ms,transform .38s '+(i*40)+'ms';io.observe(el);});
