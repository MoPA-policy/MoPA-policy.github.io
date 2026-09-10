# MoPA 论文主页

基于 `assets/paper.pdf` 的英文静态项目页，无需安装依赖或构建。页面依次包含 Overview、Method、Benchmarks、Real World 和 Citation。

- Overview 为完整首屏，包含论文标题、作者、单位和资源按钮。
- Method 展示架构与三张分析图；桌面端两列底部对齐，窄屏顺序排列。
- Benchmarks 使用论文 Tables I–II 的数据，展示三个测试集的平均成功率；窄屏切换为横向条形图。
- Real World 展示真机实验图和四个任务的视频，每个任务四段。视频已制作成 4 倍速，进入视口时静音循环播放，离开时暂停；开启“减少动态效果”后改为手动播放。

## 本地预览

直接用浏览器打开 `index.html`，或在项目目录运行：

```bash
python3 -m http.server 8000
```

然后访问 `http://localhost:8000`。修改文件后刷新页面即可。

## 文件组织

```text
.
├── index.html               # 页面内容、图表数据、图注和链接
├── styles.css               # 样式、图表和响应式布局
├── script.js                # 内联图加载、视频播放、导航、复制引用和滚动
├── assets/
│   ├── paper.pdf            # 论文原稿
│   ├── main.svg             # MoPA 架构图
│   ├── teaser.svg           # 架构范式对比与主要结果
│   ├── attention.svg        # 注意力可视化
│   ├── tsne.svg             # 查询表征分析
│   ├── real_exp.svg         # 真机任务、平台和结果
│   ├── inline/              # main、teaser、tsne、real_exp 的 SVG 加载资源
│   ├── logos/               # arXiv、GitHub、Hugging Face 标志
│   └── demos/web/           # 16 段 MP4 视频和 16 张 JPEG 封面
├── .gitignore
├── .nojekyll
├── LICENSE
└── README.md
```

## 修改内容与资源

正文、图注、任务说明及链接在 `index.html` 中维护。柱状图的每个数据点同时包含 `--value` 和可见数值，修改时须保持一致；其数值来自论文 Tables I–II。

`main`、`teaser`、`tsne` 和 `real_exp` 各有两份资源：`assets/` 下的 SVG 用作后备图片，`assets/inline/` 下同名 JS 保存内联 SVG 数据。页面靠近图像时加载 JS，将后备图片替换为可选择文字的 SVG；JavaScript 不可用或加载失败时仍显示后备图。两种方式均使用资源内嵌的字体与图像，不依赖外部字体服务。`attention.svg` 直接作为图片展示。

更新上述四张图时，须同步对应 SVG 与内联 JS 中的图形数据，保留各内联图独立的元素 ID 及其引用。当前仓库没有图片转换或资源生成脚本。图片比例变化时，还需同步 `index.html` 对应图片的 `width` 和 `height`，以正确预留空间。

视频与封面按 `taskN_demoM.mp4` / `taskN_demoM.jpg` 成对命名。task1 为配色分类，task2 为水果收集，task3 为跨桌搬运，task4 为微波炉取物。当前视频与封面合计约 35.9 MiB；视频采用 H.264、960×540、24 fps、yuv420p、无音轨。4 倍速已写入文件，网页以正常速率播放。替换视频时同步检查任务对应关系、速度标注和封面。

## 发布前待填

- 作者与单位：填写标题区的空 `placeholder-text` 标签，并调整单位上标；填写后灰色占位文字自动消失。
- arXiv、Code、Hugging Face：为对应链接添加 `href` 并移除 `aria-disabled`；代码公开后移除 `Coming soon`。
- BibTeX：补充正式作者、出版信息及其他引用字段。

## 发布文件

将 `index.html`、`styles.css`、`script.js`、完整 `assets/` 和 `.nojekyll` 一并提交并发布。资源使用相对路径，支持部署在域名根目录或仓库子路径。发布前确认新增资源已纳入版本控制，尤其是 SVG、`assets/inline/`、logo、视频和封面。

`.gitignore` 排除系统临时文件与 `assets/demos/task*_demo*.mp4` 格式的原始录制，保留 `assets/demos/web/` 中的网页资源。当前仓库不包含原始录制或视频处理脚本。
