"""Make an offline HTML page with all dependencies embedded, without npm."""
from pathlib import Path
from base64 import b64encode
import json,re
root=Path(__file__).resolve().parents[1]
mods={}
for folder in ['src','vendor']:
    for p in (root/folder).glob('*.js'):
        code=p.read_text()
        def change(m):
            path=(p.parent/m[2]).resolve()
            return m[1]+json.dumps('isle/'+str(path.relative_to(root)))
        code=re.sub(r'''(from\s+)["'](\.{1,2}/[^"']+)["']''',change,code)
        mods['isle/'+str(p.relative_to(root))]=code
out=root/'dist';out.mkdir(exist_ok=True)
assets={k:'data:text/javascript;base64,'+b64encode(v.encode()).decode() for k,v in mods.items()}
page=(root/'index.html').read_text();css=(root/'style.css').read_text()
for p in (root/'media').glob('*.woff*'):css=css.replace('./media/'+p.name,'data:font/woff;base64,'+b64encode(p.read_bytes()).decode())
page=page.replace('<link rel="stylesheet" href="./style.css">','<style>'+css+'</style>')
media={p.name:'data:video/mp4;base64,'+b64encode(p.read_bytes()).decode() for p in (root/'media').glob('*.mp4')}
model_names=[f'{name}-{tier}.glb' for name in ['stone-bridge','cushion','lantern'] for tier in ['high','low']]
models={name:'data:model/gltf-binary;base64,'+b64encode((root/'assets/models'/name).read_bytes()).decode() for name in model_names}
texture_names={'albedo':'rock-albedo.webp','normal':'rock-normal.webp','orm':'rock-orm.webp'}
textures={key:'data:image/webp;base64,'+b64encode((root/'assets/textures'/name).read_bytes()).decode() for key,name in texture_names.items()}
bootstrap='<script type="importmap">'+json.dumps({'imports':assets},separators=(',',':'))+'</script><script>globalThis.ISLE_MEDIA='+json.dumps(media,separators=(',',':'))+';globalThis.ISLE_MODELS='+json.dumps(models,separators=(',',':'))+';globalThis.ISLE_TEXTURES='+json.dumps(textures,separators=(',',':'))+'</script><script type="module">import "isle/src/main.js";</script>'
page=page.replace('<script type="module" src="./src/main.js"></script>',bootstrap)
(out/'index.html').write_text(page)
print('Built',len(page.encode()),'bytes')
