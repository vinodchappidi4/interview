import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import StartInterview from './pages/StartInterview';
import FetchInterview from './pages/FetchInterview';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/startinterview" element={<StartInterview />} />
      <Route path="/fetchinterview" element={<FetchInterview />} />
    </Routes>
  );
}

export default App;