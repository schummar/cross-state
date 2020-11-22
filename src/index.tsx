import * as React from 'react';
import * as ReactDOM from 'react-dom';

import App from './App';
import App2 from './App2';

var mountNode = document.getElementById('app');
ReactDOM.render(
  <div>
    <App />
    {/* <App2 /> */}
  </div>,
  mountNode
);
