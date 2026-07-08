import React from 'react';
import { render as rtlRender } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { I18nProvider } from './lib/i18n.jsx';

function render(ui, { route = '/', ...options } = {}) {
  window.history.pushState({}, 'Test page', route);

  function Wrapper({ children }) {
    return (
      <I18nProvider>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </I18nProvider>
    );
  }

  return rtlRender(ui, { wrapper: Wrapper, ...options });
}

export * from '@testing-library/react';
export { render };
