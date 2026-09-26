import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
} from '@chakra-ui/react';
import { useState } from 'react';
import { ResetDialog, SettingsFields, useSettingsForm } from './SettingsForm';

export function SettingsModal({
  isOpen,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const form = useSettingsForm(isOpen, onSaved);
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="lg" scrollBehavior="inside" isCentered>
        <ModalOverlay bg="blackAlpha.500" />
        <ModalContent mx={3} my={3} maxH="calc(100dvh - 1.5rem)" overflow="hidden">
          <ModalHeader pb={1} flexShrink={0}>
            <Text as="span" display="block" fontSize="lg">
              履修パレットの設定
            </Text>
            <Text fontSize="sm" color="gray.600" fontWeight="normal" mt={1}>
              履修登録とシラバス検索の科目を自学科・他学科・共通科目に色分けします。
            </Text>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody overflowY="auto" minH="0">
            <SettingsFields form={form} />
          </ModalBody>
          <ModalFooter gap={3} flexShrink={0}>
            <Button variant="ghost" onClick={() => setResetOpen(true)}>
              設定をリセット
            </Button>
            <Button id="save-settings" colorScheme="ink" onClick={() => void form.save()}>
              保存する
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <ResetDialog isOpen={resetOpen} onClose={() => setResetOpen(false)} onConfirm={form.reset} />
    </>
  );
}
