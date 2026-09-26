import { Box, Button, Heading, Text, useToast, VStack } from '@chakra-ui/react';
import { useState } from 'react';
import { hasChromeStorage } from '../shared/storage';
import { SettingsModal } from './SettingsModal';

const SAVED_NOTICE = '保存しました。開いている履修一覧に反映されます。';

export function App({ embed }: { embed: boolean }) {
  const [open, setOpen] = useState(true);
  const toast = useToast();

  const close = () => {
    if (embed) {
      window.parent.postMessage({ source: 'hcu-rishu-settings', type: 'close' }, '*');
      return;
    }
    setOpen(false);
  };

  const saved = () => {
    if (embed) {
      window.parent.postMessage({ source: 'hcu-rishu-settings', type: 'close', saved: true }, '*');
      return;
    }
    setOpen(false);
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

  return (
    <>
      {!embed && (
        <Box maxW="720px" mx="auto" px={6} py={10}>
          <VStack align="stretch" spacing={4}>
            <Heading as="h1" size="lg" color="ink.700">
              いちぽる履修カラー
            </Heading>
            <Text>
              広島市立大学の UNIPA（いちぽる）で、履修登録とシラバス検索の科目を自学科・他学科・共通科目に色分けします。設定はこのブラウザの中だけに残ります。
            </Text>
            <Text fontSize="sm" color="gray.600">
              いちぽるを開いているときは、ツールバーのアイコンか画面左下の「色分け設定」から、同じ画面が開きます。
            </Text>
            {!open && (
              <Button alignSelf="flex-start" onClick={() => setOpen(true)}>
                設定を開く
              </Button>
            )}
            {!hasChromeStorage() && (
              <Button as="a" href="./demo.html" alignSelf="flex-start" variant="outline" colorScheme="ink">
                見本の一覧で色を確認する
              </Button>
            )}
          </VStack>
        </Box>
      )}
      <SettingsModal isOpen={open} onClose={close} onSaved={saved} />
    </>
  );
}
