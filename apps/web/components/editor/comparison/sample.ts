export const COMPARISON_IMAGE = {
  id: "comparison-demo-landscape",
  url: "/editor-comparison/landscape.svg",
} as const;

export const COMPARISON_SAMPLE = `<h1>任务描述 · Editor comparison</h1>
<p>在两个编辑器中测试中文输入、选区和快捷键。Try typing, selecting text and undoing changes.</p>
<h2>格式与结构</h2>
<p><strong>粗体 Bold</strong> · <em>斜体 Italic</em> · <u>下划线 Underline</u> · <s>删除线 Strike</s> · <code>const ready = true;</code></p>
<blockquote><p>保留相同的内容，对比编辑手感和 HTML 往返结果。</p></blockquote>
<h2>图片 · Image</h2>
<p>这张本地样例图片可直接调整尺寸、对齐方式和替代文本，再发送到另一侧对比。</p>
<image-component id="comparison-demo-image" src="${COMPARISON_IMAGE.id}" alt="日落下的山峦与湖泊 · Mountains and lake at sunset" width="100%" height="auto" alignment="center" aspectratio="2" status="uploaded"></image-component>
<p>在这里继续编写任务说明。</p>`;

export const FULL_COMPARISON_SAMPLE = `${COMPARISON_SAMPLE}
<h3>列表与待办</h3><ul><li><p>第一项</p></li><li><p>第二项</p></li></ul><ol start="3"><li><p>编号三</p></li><li><p>编号四</p></li></ol>
<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"></label><div><p>已完成</p></div></li><li data-type="taskItem" data-checked="false"><div><p>待完成</p></div></li></ul>
<h3>表格</h3><table><tbody><tr><th><p>功能</p></th><th><p>状态</p></th></tr><tr><td><p>富文本</p></td><td><p>测试中</p></td></tr></tbody></table>
<pre><code class="language-javascript">const ready = true;\nconsole.log(ready);</code></pre><hr>
<p><a href="https://platejs.org">Plate 文档</a> · <span style="color:#266df0;background-color:#c9dafb">文字颜色与背景</span></p>
<p style="text-align:center">居中文本</p>
<div data-block-type="callout-component" data-logo-in-use="emoji" data-emoji-unicode="128161"><p>提示块：比较格式和业务属性。</p></div>
<p>负责人 <mention-component id="Alex" entity_identifier="demo-alex" entity_name="user_mention"></mention-component></p>`;
