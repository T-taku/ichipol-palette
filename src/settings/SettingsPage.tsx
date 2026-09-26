import { Box, Button, Flex, Heading, Stack, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { AuthorLink, ResetDialog, SettingsFields, useSettingsForm } from './SettingsForm';

export function SettingsPage({ onSaved }: { onSaved: () => void }) {
  const form = useSettingsForm(true, onSaved);
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <Box maxW="640px" mx="auto" px={{ base: 4, md: 6 }} py={{ base: 6, md: 10 }}>
      <Stack spacing={1} mb={6}>
        <Heading as="h1" size="lg" color="ink.700">
          履修パレットの設定
        </Heading>
        <Text fontSize="sm" color="gray.600">
          履修登録とシラバス検索の科目を自学科・他学科・共通科目に色分けします。
        </Text>
      </Stack>

      <Box
        as="main"
        bg="#fffdf8"
        borderWidth="1px"
        borderColor="#e1d8c9"
        borderRadius="xl"
        boxShadow="0 12px 32px rgba(28, 36, 48, 0.08)"
        overflow="hidden"
      >
        <Box px={{ base: 4, md: 6 }} pt={{ base: 5, md: 6 }} pb={2}>
          <SettingsFields form={form} />
        </Box>
        <Flex
          position="sticky"
          bottom={0}
          justify="flex-end"
          gap={3}
          px={{ base: 4, md: 6 }}
          py={4}
          bg="#fffdf8"
          borderTopWidth="1px"
          borderColor="#eee6d8"
        >
          <Button variant="ghost" onClick={() => setResetOpen(true)}>
            設定をリセット
          </Button>
          <Button id="save-settings" colorScheme="ink" onClick={() => void form.save()}>
            保存する
          </Button>
        </Flex>
      </Box>

      <Box as="footer" mt={6} textAlign="center">
        <AuthorLink />
      </Box>

      <ResetDialog isOpen={resetOpen} onClose={() => setResetOpen(false)} onConfirm={form.reset} />
    </Box>
  );
}
