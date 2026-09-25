import { ChakraProvider } from '@chakra-ui/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { buildTheme } from './theme';

const embed = new URLSearchParams(location.search).get('embed') === '1';
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ChakraProvider theme={buildTheme(embed)}>
        <App embed={embed} />
      </ChakraProvider>
    </StrictMode>,
  );
}
