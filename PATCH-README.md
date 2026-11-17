# 桃花岛 · 岸石风化材质 增量补丁

把这个 `patchset/` 目录里的文件覆盖到原版项目根目录，即可获得全部改动。

## 覆盖后需要手动删除的文件

原版的试验性岸石材质已被新的风化岩石材质取代，请删除：

```
src/shore-material.js
assets/textures/shore-rock-color.webp
assets/textures/shore-rock-normal.webp
```

## 改动清单

### 新增

| 文件 | 说明 |
|---|---|
| `src/rock-material.js` | 共享岩石材质：世界空间三平面贴图、程序化多尺度苔藓、缝隙遮蔽、实例偏移 |
| `assets/textures/rock-albedo.webp` | 浅灰风化石 Albedo（sRGB，1024²） |
| `assets/textures/rock-normal.webp` | 法线贴图（linear，1024²） |
| `assets/textures/rock-orm.webp` | ORM 贴图（linear，512²） |
| `assets/textures/rock-constants.json` | Albedo linear mean 与 tint gain |
| `tools/build_rock_textures.py` | 贴图生成与分级脚本（可复现） |
| `tools/lab.html`、`tools/lab.mjs` | 材质实验台 |
| `tools/shoot.mjs`、`tools/shoot_software.mjs` | 桌面/移动端与 CPU 回退截图脚本 |
| `tools/stats.mjs`、`tools/measure.mjs` | draw call 与三角面统计 |
| `vite.config.js`、`.gitignore` | 开发服务器与忽略规则 |

### 修改

| 文件 | 说明 |
|---|---|
| `src/landscape.js` | 岸石改为 2–4 块相互倚靠的圆润岩块，烘焙 `aCavity`；各石块形态互不相同 |
| `src/garden.js` | 岩石实例化、实例数据与共享材质接入 |
| `src/main.js` | 加载岩石贴图、创建场景与交互 |
| `src/software.js` | CPU 回退：sRGB→linear、多尺度苔藓、线性光照、收紧后的苔藓遮罩 |
| `src/raster.js` | 识别 `material.texture?.linear`，在线性空间合成后编码 sRGB |
| `tools/build.py` | 打包新的岩石贴图与资源 |
| `README.md`、`assets/textures/README.md` | 材质说明与贴图来源（Poly Haven CC0） |

## 重新构建离线单文件

```
python tools/build.py
```

产物为 `dist/index.html`（约 5.9 MB），已内嵌全部模型、贴图、视频与字体。
