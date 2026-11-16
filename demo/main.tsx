import React from 'react';
import {createRoot} from 'react-dom/client';
import WorldTerminal from '../src/launcher/components/WorldTerminal';
import './style.css';
createRoot(document.getElementById('root')!).render(<main><h1>知识库问答</h1><p>Markdown知识库检索与流式回答。真实问答需要配置自己的服务；打开聊天框不会直接调用模型。</p><WorldTerminal/></main>);
