import { Box, useToast } from '@chakra-ui/react';
import { SettingsModal } from './SettingsModal';
import { SettingsPage } from './SettingsPage';

const SAVED_NOTICE = '設定を保存しました';

export function App({ embed }: { embed: boolean }) {
  const toast = useToast();

  if (embed) {
    return (
      <SettingsModal
        isOpen
        onClose={() => window.parent.postMessage({ source: 'hcu-rishu-settings', type: 'close' }, '*')}
        onSaved={() => window.parent.postMessage({ source: 'hcu-rishu-settings', type: 'close', saved: true }, '*')}
      />
    );
  }

  const saved = () => {
    toast({
      id: 'settings-saved',
      position: 'bottom',
      duration: 4000,
      render: () => (
        <Box
          role="status"
          bg="#102735"
          color="#fffdf8"
          px={4}
          py={3}
          mb={4}
          borderRadius="md"
          boxShadow="0 8px 24px rgba(28, 36, 48, 0.24)"
          fontSize="sm"
          lineHeight="1.5"
          maxW="min(480px, calc(100vw - 32px))"
        >
          {SAVED_NOTICE}
        </Box>
      ),
    });
  };

  return <SettingsPage onSaved={saved} />;
}
