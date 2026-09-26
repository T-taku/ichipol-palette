import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertIcon,
  Box,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  Select,
  Stack,
  Switch,
  Text,
} from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import { defaultSettings } from '../shared/defaults';
import { departmentsFor, FACULTY_ASSIGNMENT, isFacultyAssignment, isPresetFaculty, ORG_TREE } from '../shared/org';
import { loadSettings, saveSettings } from '../shared/storage';
import type { CourseCategory, Settings } from '../shared/types';

const COLOR_LABEL: Record<CourseCategory, string> = {
  own: '自学科の講義',
  other: '他学科の講義',
  common: '共通科目',
};

const CUSTOM = '__custom';

export const AUTHOR_X = { handle: '@T_taku0427', url: 'https://x.com/T_taku0427' } as const;

export function useSettingsForm(active: boolean, onSaved: () => void) {
  const [draft, setDraft] = useState<Settings>(defaultSettings);
  const [facultyCustom, setFacultyCustom] = useState(false);
  const [deptCustom, setDeptCustom] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    let cancel = false;
    void loadSettings().then((settings) => {
      if (cancel) return;
      setDraft(settings);
      setFacultyCustom(Boolean(settings.faculty) && !isPresetFaculty(settings.faculty));
      setDeptCustom(Boolean(settings.department) && !departmentsFor(settings.faculty).includes(settings.department));
    });
    return () => {
      cancel = true;
    };
  }, [active]);

  const patch = (partial: Partial<Settings>) => {
    setDraft((current) => ({ ...current, ...partial }));
  };

  const save = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      await saveSettings(draft);
      onSaved();
    } finally {
      savingRef.current = false;
    }
  };

  const reset = () => {
    const next = defaultSettings();
    next.rules = draft.rules;
    setDraft(next);
    setFacultyCustom(false);
    setDeptCustom(false);
  };

  return { draft, patch, facultyCustom, setFacultyCustom, deptCustom, setDeptCustom, save, reset };
}

export type SettingsFormState = ReturnType<typeof useSettingsForm>;

export function SettingsFields({ form }: { form: SettingsFormState }) {
  const { draft, patch, facultyCustom, setFacultyCustom, deptCustom, setDeptCustom } = form;
  const deptOptions = departmentsFor(draft.faculty);
  const showDeptSelect = isPresetFaculty(draft.faculty) && !facultyCustom;
  const affiliation = [draft.faculty, draft.department].filter(Boolean).join(' ');

  return (
    <>
      {!draft.department && !draft.faculty && (
        <Alert status="info" borderRadius="md" mb={4} bg="ink.50">
          <AlertIcon />
          <AlertDescription>
            所属が空のあいだは、共通科目だけ色が付きます。自学科と他学科を分けるには、学部と学科を選んで保存してください。
          </AlertDescription>
        </Alert>
      )}
      <Stack spacing={6}>
        <Stack spacing={4}>
          <Heading as="h2" size="sm">
            自分の所属
          </Heading>
          <Text fontSize="sm" color="gray.600" mt={-2}>
            ここで選んだ学科の講義が自学科、別の学科の講義が他学科になります。情報科学部の1年で学科がまだ決まっていないときは「学部配属」を選んでください。
          </Text>
          <FormControl>
            <FormLabel htmlFor="faculty">学部</FormLabel>
            <Select
              id="faculty"
              value={facultyCustom ? CUSTOM : draft.faculty}
              onChange={(event) => {
                const value = event.target.value;
                if (value === CUSTOM) {
                  setFacultyCustom(true);
                  setDeptCustom(true);
                  patch({ faculty: isPresetFaculty(draft.faculty) ? '' : draft.faculty, department: '' });
                  return;
                }
                setFacultyCustom(false);
                const options = departmentsFor(value);
                const department = options.includes(draft.department) ? draft.department : '';
                setDeptCustom(false);
                patch({ faculty: value, department });
              }}
            >
              <option value="">未選択</option>
              {ORG_TREE.map((org) => (
                <option key={org.faculty} value={org.faculty}>
                  {org.faculty}
                </option>
              ))}
              <option value={CUSTOM}>その他（手入力）</option>
            </Select>
            {facultyCustom && (
              <Input
                mt={2}
                id="faculty-custom"
                aria-label="学部の手入力"
                value={draft.faculty}
                placeholder="例: 情報科学研究科"
                onChange={(event) => patch({ faculty: event.target.value })}
              />
            )}
          </FormControl>
          <FormControl>
            <FormLabel htmlFor={showDeptSelect && !deptCustom ? 'department' : 'department-custom'}>学科</FormLabel>
            {showDeptSelect && (
              <Select
                id="department"
                mb={deptCustom ? 2 : 0}
                value={deptCustom ? CUSTOM : draft.department}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === CUSTOM) {
                    setDeptCustom(true);
                    patch({ department: deptOptions.includes(draft.department) ? '' : draft.department });
                    return;
                  }
                  setDeptCustom(false);
                  patch({ department: value });
                }}
              >
                <option value="">未選択</option>
                {deptOptions.map((name) => (
                  <option key={name} value={name}>
                    {name === FACULTY_ASSIGNMENT ? '学部配属（1年）' : name}
                  </option>
                ))}
                <option value={CUSTOM}>その他（手入力）</option>
              </Select>
            )}
            {(deptCustom || !showDeptSelect) && (
              <Input
                id="department-custom"
                aria-label="学科の手入力"
                value={draft.department}
                placeholder="例: 情報工学科"
                onChange={(event) => patch({ department: event.target.value })}
              />
            )}
            <FormHelperText>
              {isFacultyAssignment(draft.department)
                ? '学科名の付いていない情報科学部の専門科目を自学科の色にします。情報工学科などの学科名が付いた科目は他学科です。'
                : affiliation
                  ? `「${affiliation}」の講義を自学科にします。`
                  : '候補は広島市立大学の学部構成です。一覧に無い名称はその他から入力できます。'}
            </FormHelperText>
          </FormControl>
        </Stack>

        <Stack spacing={4}>
          <Heading as="h2" size="sm">
            色の変更
          </Heading>
          {(['own', 'other', 'common'] as const).map((key) => (
            <ColorField
              key={key}
              label={COLOR_LABEL[key]}
              value={draft.colors[key]}
              onChange={(value) => patch({ colors: { ...draft.colors, [key]: value } })}
            />
          ))}
          <LegendPreview colors={draft.colors} enabled={draft.enabled} show={draft.showLegend} />
        </Stack>

        <Stack spacing={3} pt={1}>
          <FormControl display="flex" alignItems="center" justifyContent="space-between">
            <FormLabel htmlFor="enabled" mb={0} fontWeight="normal">
              色分けを有効にする
            </FormLabel>
            <Switch id="enabled" isChecked={draft.enabled} onChange={(event) => patch({ enabled: event.target.checked })} />
          </FormControl>
          <FormControl display="flex" alignItems="center" justifyContent="space-between">
            <FormLabel htmlFor="legend" mb={0} fontWeight="normal">
              画面に凡例を出す
            </FormLabel>
            <Switch id="legend" isChecked={draft.showLegend} onChange={(event) => patch({ showLegend: event.target.checked })} />
          </FormControl>
        </Stack>
      </Stack>
      <Text mt={4} fontSize="xs" color="gray.500">
        所属と色はこのブラウザだけに保存します。履修登録とシラバス検索の科目に関するデータは外部へ送信されません。
      </Text>
    </>
  );
}

export function ResetDialog({
  isOpen,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose} isCentered>
      <AlertDialogOverlay>
        <AlertDialogContent mx={3}>
          <AlertDialogHeader>設定をリセットする</AlertDialogHeader>
          <AlertDialogBody>学部・学科と3色をリセットします。保存するまで履修一覧には反映されません。</AlertDialogBody>
          <AlertDialogFooter>
            <Button ref={cancelRef} variant="ghost" onClick={onClose}>
              やめる
            </Button>
            <Button
              colorScheme="red"
              ml={3}
              onClick={() => {
                onConfirm();
                onClose();
              }}
            >
              戻す
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
}

export function AuthorLink() {
  return (
    <Text fontSize="xs" color="gray.500">
      X:{' '}
      <a href={AUTHOR_X.url} target="_blank" rel="noopener noreferrer">
        {AUTHOR_X.handle}
      </a>
    </Text>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <FormControl>
      <FormLabel mb={1}>{label}</FormLabel>
      <HStack>
        <Input
          type="color"
          aria-label={`${label}の色`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          w="72px"
          p={1}
          h="40px"
        />
        <Box flex="1" borderRadius="md" px={3} py={2} bg={value} boxShadow="inset 4px 0 0 rgba(0,0,0,0.28)">
          {label}
        </Box>
      </HStack>
    </FormControl>
  );
}

function LegendPreview({
  colors,
  enabled,
  show,
}: {
  colors: Settings['colors'];
  enabled: boolean;
  show: boolean;
}) {
  return (
    <Box borderWidth="1px" borderColor="gray.200" borderRadius="md" p={3} aria-label="凡例の見本">
      <Text fontSize="xs" color="gray.500" mb={2}>
        凡例の見本
      </Text>
      {!enabled && (
        <Text fontSize="sm" color="gray.600">
          色分けはオフです。
        </Text>
      )}
      {enabled && !show && (
        <Text fontSize="sm" color="gray.600" mb={2}>
          履修一覧の凡例は隠し、色だけ付けます。
        </Text>
      )}
      {enabled && (
        <Stack spacing={2}>
          {(['own', 'other', 'common'] as const).map((key) => (
            <HStack key={key} spacing={3}>
              <Box w="16px" h="16px" borderRadius="sm" bg={colors[key]} boxShadow="inset 3px 0 0 rgba(0,0,0,0.35)" flexShrink={0} />
              <Text fontSize="sm">{COLOR_LABEL[key]}</Text>
            </HStack>
          ))}
        </Stack>
      )}
    </Box>
  );
}
