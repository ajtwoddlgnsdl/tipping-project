import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css' // Tailwind 설정이 들어있는 CSS

ReactDOM.createRoot(document.getElementById('root')).render(
  <GoogleOAuthProvider clientId="867949810382-vrf2c4o1u3rin573ikhdt5n9gv87qltj.apps.googleusercontent.com">
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </GoogleOAuthProvider>,
)