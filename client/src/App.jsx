import './App.css'
import {useState, useEffect, useRef} from 'react'
import { Outlet } from 'react-router-dom';
import { useXTerm } from 'react-xtermjs'
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';

function App() {

  const term = new Terminal({fontFamily: '', letterSpacing: -1, fontSize: 16, lineHeight: 2, theme:{background: '#1e1e1e'}})
 
  return (
    <>
      {/* <Editor height="90vh" defaultLanguage="javascript" defaultValue={value} />; */}
      {/* <div ref={ref} style={{ height: '100%', width: '100%' }}></div> */}
      <Outlet context={{term: term}} />
    </>
  )
}

export default App
