// the desktop mini widget and reminder pop-ups get their layout before anything draws (a file, not inline, for the Content Security Policy)
if(location.hash==='#widget'||location.hash.startsWith('#ask~'))document.documentElement.classList.add('widget')
