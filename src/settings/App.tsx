import { Box, Button, Heading, Text, VStack } from '@chakra-ui/react';
import { useState } from 'react';
import { hasChromeStorage } from '../shared/storage';
import { SettingsModal } from './SettingsModal';

export function App({ embed }: { embed: boolean }) {
  const [open, setOpen] = useState(true);

  const close = () => {
    if (embed) {
      window.parent.postMessage({ source: 'hcu-rishu-settings', type: 'close' }, '*');
      return;
    }
    setOpen(false);
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
      <SettingsModal isOpen={open} onClose={close} />
    </>
  );
}
