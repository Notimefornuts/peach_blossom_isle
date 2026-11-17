# 桃花岛 · 水流花开

解压后双击 **dist/index.html** 即可离线游览。Three.js、三维模型、五段短片、字体与中英内容都已嵌入。外部经文出处链接需要联网。

## 用 npm 启动

需要 Node.js 18 或更高版本。在项目根目录运行：

```bash
npm install
npm run dev
```

在终端显示的本地地址打开网页。生成网页构建版运行 `npm run build`，输出目录为 `build/`；随后可用 `npm run preview` 预览。直接离线打开的单文件版本仍在 `dist/index.html`。

## 操作

- 鼠标拖拽或单指滑动环看，滚轮或双指捏合缩放。聚焦画面后，可使用左右方向键、+ / −、Home 操作相机。
- 一层主入口的两扇木门默认半开，分别点击木门可以向内开启或关闭；门扇使用独立门轴，保留门框、门槛、实木下嵌板、三维格栅、合页和古铜门环。
- 窗户采用苏式园林纹样，二层正面为三联步步锦，书房为疏朗步步锦，客厅正面为海棠形木窗格。均嵌在真实墙洞内，具有窗台与透光窗纸。竹林侧二层为完整墙面；卧室内部楼梯连接两层，临窗可见木床、软枕、床头柜与纸灯。
- 点击物件或小圆点进入五个生活主题。桃树可摇落花瓣，围棋可交替落子，陶盏可顺流漂动，书桌可翻书，卧室纸灯可调亮度，竹林石灯可点亮。点击湖面产生涟漪。
- 曲水从竹林前流向左侧棋桌附近，花盏和水中花瓣随之漂流。主游线为入口平台 → 棋桌旁 → 斜向石拱桥 → 前岸临水石径 → 竹林前打坐台；主屋与打坐台之间另有低矮石板桥，形成回游。两座桥下的水面连续，入口平台保持干燥。
- 内容面板提供开示、短片、文章与 30 秒实修入口。点击「全岛」、复位按钮或 Esc 返回。
- 时段为白天、黄昏 18:00、夜晚 22:00。声音默认关闭。纯享模式隐藏热点与解说，右下角可退出。

## 源码

| 路径 | 内容 |
|---|---|
| index.html、style.css | 页面布局、主题、排版与手机适配 |
| src/main.js | 场景、相机、拾取、镜头过渡和双语内容界面 |
| src/house.js | 两层主屋、双扇开合木门、墙洞格栅窗、室内楼梯、卧室与家具 |
| src/windows.js | 三联步步锦、书房步步锦与海棠形木窗格，三维细木构件和接缝合并 |
| src/roof.js | 原尺寸的四坡屋顶、叠压板瓦与筒瓦、正脊与角脊、封檐板、椽子和简化斗拱 |
| src/garden.js、src/landscape.js | 不规则岛岸、连通石径、入口平台、石拱桥落脚石、石板桥、植物、茶席与竹林 |
| src/courtyard-layout.js | 俯视图与三维场景共用的坐标：水道、双桥、石台、石灯与相连石径 |
| src/courtyard.js | 曲水中心线、变宽河岸、浅水着色器和漂流布局 |
| src/paving.js | 共享边界的不规则三维石板、倒角与嵌地厚度，合并为一次绘制 |
| src/model-assets.js、assets/models/ | 上传石拱桥、蒲团、石灯的本地 GLB 加载、顶点配色与高低两档模型 |
| src/tree.js、src/petals.js | 桃树骨架、花枝、微风、落花及湖面漂流 |
| src/lake.js | 远山、湖面着色器、镜像反射和点击涟漪 |
| src/software.js、src/raster.js | 关闭图形加速时同一 Three.js 场景的软件渲染 |
| src/content.js、src/sound.js | 中英文字、经文出处、合成水声与风铃 |
| media/、tools/make_films.py | 五段原创无声短片与其可编辑生成脚本 |
| vendor/ | 项目自带的 Three.js 和 OrbitControls 及授权 |
| docs/courtyard-layout.png、.svg | 实施前的俯视布局预览，随项目坐标同步更新 |

主屋的木纹、叠瓦、梁柱、家具与软件渲染沿用并改造自用户提供的「桜日和 · 樱花水岸小屋」项目。岛屿、湖面、两层空间和生活主题交互为本次扩展。

开示页引用公版《佛遗教经》，英语为本项目译文。文章、练习与短片为本项目配套示例内容，未接入宁师正式开示视频。可在 src/content.js 与 media/ 中替换。短片每段 9 秒，均可播放。

## 开发与构建

也可以在此目录运行 `python -m http.server 8000`，用浏览器打开 http://localhost:8000。运行 `python tools/build.py` 可重建可直接双击打开的 dist/index.html，构建只使用 Python 标准库。

仅重新制作短片时需要 Pillow 和 ffmpeg，运行 `python tools/make_films.py`。浏览网页与构建离线单页均无需它们。

三件在用模型均已先焊接 UV 接缝再减面，避免破面。上传的石拱桥原有 50 万个三角面，网页采用高档 2.2 万、低档 1 万个三角面；配色烘焙为顶点色。石桥、蒲团和石灯的六个在用 GLB 合计约 1.3 MB，运行时只加载所需的一档。源码自带优化后的模型。

仅重新准备模型时需安装 `numpy scipy Pillow fast-simplification trimesh`，把原始 `拱桥.glb`、`蒲团.glb`、`石灯.glb` 放入同一目录，然后运行 `python tools/prepare_courtyard_models.py 该目录`。这是可选的资产处理步骤，`npm install` 与网页构建不依赖 Python 第三方包。

仅重新处理石拱桥时需安装 Blender、`numpy`、`scipy` 和 Pillow，然后运行 `python tools/prepare_stone_bridge.py 石头拱桥.glb`。

仅重绘俯视布局图时需安装 Python 包 `cairosvg` 或 Inkscape。运行 `node tools/export_layout.mjs docs/layout-data.json`，再运行 `python tools/render_layout.py docs/layout-data.json`。绘图与三维场景直接读取同一份布局数据。

WebGL 2 可用时使用水面 Shader、缓存投影和降分辨率倒影。低性能设备减少花枝与花瓣、关闭实时投影。关闭 WebGL 的浏览器自动使用软件渲染，保留镜头、灯光、倒影和交互。减少动态效果开启时，环境动画减速并直接定位镜头。

## 验证

已在浏览器实际打开并检查桌面全景、书房近景与手机 390px 竖屏布局。模拟触屏验证单指旋转、双指缩放，并验证滚轮、三个时段、五个主题的短片播放、双语、声音、纯享与返回功能。五段短片均为本地嵌入视频。WebGL 水面着色器另行通过 OpenGL ES 编译检查；预览环境使用软件渲染。真实手机 GPU 性能仍依设备而异。

## 岸石材质试验

岛屿正面一小段岸石使用经柔化的 Poly Haven Rock 01 免费材质；同一石纹由多块石头共享，方便与周围原版石岸对照。贴图来源和授权见 `assets/textures/README.md`。离线版也包含贴图。

