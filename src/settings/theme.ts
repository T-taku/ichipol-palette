import { extendTheme } from '@chakra-ui/react';

export function buildTheme(embed: boolean) {
  return extendTheme({
    config: { initialColorMode: 'light', useSystemColorMode: false },
    fonts: {
      heading: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", Meiryo, "Noto Sans CJK JP", "WenQuanYi Micro Hei", sans-serif',
      body: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", Meiryo, "Noto Sans CJK JP", "WenQuanYi Micro Hei", sans-serif',
    },
    colors: {
      ink: {
        50: '#eef3f6',
        100: '#d5e2ea',
        500: '#1b3a4b',
        600: '#163243',
        700: '#102735',
      },
    },
    styles: {
      global: {
        'html, body, #root': {
          height: embed ? '100%' : undefined,
          margin: embed ? 0 : undefined,
          bg: embed ? 'transparent' : undefined,
        },
        body: {
          bg: embed ? 'transparent' : '#f3eee6',
          color: '#1c2430',
        },
      },
    },
    components: {
      Modal: {
        baseStyle: {
          dialog: { bg: '#fffdf8' },
        },
      },
    },
  });
}
