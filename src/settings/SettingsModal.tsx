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
  Badge,
  Box,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
} from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import { classify, reasonLabel } from '../shared/classify';
import { createRuleId, defaultSettings } from '../shared/defaults';
import { departmentsFor, isPresetFaculty, ORG_TREE } from '../shared/org';
import { loadSettings, saveSettings } from '../shared/storage';
import { CATEGORY_LABEL, type CourseCategory, type OverrideRule, type RuleField, type RuleMatch, type Settings } from '../shared/types';

const FIELD_LABEL: Record<RuleField, string> = {
  name: '科目名',
  code: '授業コード',
  department: '開講学科・学部',
  division: '科目区分',
  any: '行全体',
};

const MATCH_LABEL: Record<RuleMatch, string> = {
  includes: 'を含む',
  equals: 'と一致',
  prefix: 'で始まる',
  regex: '正規表現',
};

export function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [draft, setDraft] = useState<Settings>(defaultSettings);
  const [facultyCustom, setFacultyCustom] = useState(false);
  const [deptCustom, setDeptCustom] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancel = false;
    void loadSettings().then((settings) => {
      if (cancel) return;
      setDraft(settings);
      setFacultyCustom(Boolean(settings.faculty) && !isPresetFaculty(settings.faculty));
      setDeptCustom(Boolean(settings.department) && !departmentsFor(settings.faculty).includes(settings.department));
      setStatus('');
      setError('');
    });
    return () => {
      cancel = true;
    };
  }, [isOpen]);

  const deptOptions = departmentsFor(draft.faculty);
  const showDeptSelect = isPresetFaculty(draft.faculty) && !facultyCustom;

  const patch = (partial: Partial<Settings>) => {
    setDraft((current) => ({ ...current, ...partial }));
    setStatus('');
  };

  const save = async () => {
    const invalid = draft.rules.find((rule) => rule.enabled && rule.match === 'regex' && rule.pattern && !validRegex(rule.pattern));
    if (invalid) {
      setError('正規表現として読めないルールがあります。直してから保存してください。');
      return;
    }
    setError('');
    await saveSettings(draft);
    setStatus('保存しました。いちぽるの一覧に反映されます。');
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside" isCentered>
        <ModalOverlay bg="blackAlpha.500" />
        <ModalContent mx={3}>
          <ModalHeader pb={1}>
            <Text as="span" display="block" fontSize="lg">
              履修カラー設定
            </Text>
            <Text fontSize="sm" color="gray.600" fontWeight="normal" mt={1}>
              自学科・他学科・共通科目の色を、このブラウザだけに保存します。
            </Text>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {!draft.department && !draft.faculty && (
              <Alert status="info" borderRadius="md" mb={4} bg="ink.50">
                <AlertIcon />
                <AlertDescription>
                  学科が空のあいだは、共通科目だけ色が付きます。自学科と他学科を分けるには、自分の学科を入れて保存してください。
                </AlertDescription>
              </Alert>
            )}
            <Tabs colorScheme="ink" isLazy={false}>
              <TabList>
                <Tab>所属</Tab>
                <Tab>色</Tab>
                <Tab>上書き</Tab>
                <Tab>試し判定</Tab>
              </TabList>
              <TabPanels>
                <TabPanel px={0}>
                  <Stack spacing={4}>
                    <FormControl display="flex" alignItems="center" justifyContent="space-between">
                      <FormLabel htmlFor="enabled" mb={0}>
                        色分けを有効にする
                      </FormLabel>
                      <Switch id="enabled" isChecked={draft.enabled} onChange={(event) => patch({ enabled: event.target.checked })} />
                    </FormControl>
                    <FormControl>
                      <FormLabel htmlFor="faculty">学部</FormLabel>
                      <Select
                        id="faculty"
                        value={facultyCustom ? '__custom' : draft.faculty}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (value === '__custom') {
                            setFacultyCustom(true);
                            patch({ faculty: isPresetFaculty(draft.faculty) ? '' : draft.faculty, department: '' });
                            setDeptCustom(true);
                            return;
                          }
                          setFacultyCustom(false);
                          const options = departmentsFor(value);
                          const department = options.includes(draft.department) ? draft.department : '';
                          setDeptCustom(false);
                          patch({ faculty: value, department });
                        }}
                      >
                        <option value="">未設定</option>
                        {ORG_TREE.map((org) => (
                          <option key={org.faculty} value={org.faculty}>
                            {org.faculty}
                          </option>
                        ))}
                        <option value="__custom">一覧にないので手入力</option>
                      </Select>
                      {facultyCustom && (
                        <Input
                          mt={2}
                          aria-label="学部の手入力"
                          value={draft.faculty}
                          placeholder="例: 情報科学研究科"
                          onChange={(event) => patch({ faculty: event.target.value })}
                        />
                      )}
                      <FormHelperText>候補は公開されている学修の手引きの学部構成です。大学院は手入力できます。</FormHelperText>
                    </FormControl>
                    <FormControl>
                      <FormLabel htmlFor="department">学科</FormLabel>
                      {showDeptSelect && (
                        <Select
                          id="department"
                          mb={deptCustom ? 2 : 0}
                          value={deptCustom ? '__custom' : draft.department}
                          onChange={(event) => {
                            const value = event.target.value;
                            if (value === '__custom') {
                              setDeptCustom(true);
                              patch({ department: deptOptions.includes(draft.department) ? '' : draft.department });
                              return;
                            }
                            setDeptCustom(false);
                            patch({ department: value });
                          }}
                        >
                          <option value="">未設定</option>
                          {deptOptions.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                          <option value="__custom">一覧にないので手入力</option>
                        </Select>
                      )}
                      {(deptCustom || !showDeptSelect) && (
                        <Input
                          id={showDeptSelect ? undefined : 'department'}
                          aria-label="学科の表記"
                          value={draft.department}
                          placeholder="例: 情報工学科"
                          onChange={(event) => patch({ department: event.target.value })}
                        />
                      )}
                      <FormHelperText>
                        画面の「開講学科」「学科組織」と照合します。情報科学部の1年次など学科配属前は、学部だけ選んでください。
                      </FormHelperText>
                    </FormControl>
                    <FormControl display="flex" alignItems="flex-start" justifyContent="space-between" gap={4}>
                      <Box>
                        <FormLabel htmlFor="faculty-wide" mb={1}>
                          学部だけの開講は自学科にする
                        </FormLabel>
                        <FormHelperText mt={0}>
                          開講欄が「情報科学部」だけで学科名がない科目を、同じ学部なら自学科にします。
                        </FormHelperText>
                      </Box>
                      <Switch
                        id="faculty-wide"
                        isChecked={draft.treatFacultyWideAsOwn}
                        onChange={(event) => patch({ treatFacultyWideAsOwn: event.target.checked })}
                      />
                    </FormControl>
                    <FormControl display="flex" alignItems="center" justifyContent="space-between">
                      <FormLabel htmlFor="legend" mb={0}>
                        画面に凡例を出す
                      </FormLabel>
                      <Switch id="legend" isChecked={draft.showLegend} onChange={(event) => patch({ showLegend: event.target.checked })} />
                    </FormControl>
                    <FormControl display="flex" alignItems="center" justifyContent="space-between">
                      <FormLabel htmlFor="badges" mb={0}>
                        科目名の横にバッジを出す
                      </FormLabel>
                      <Switch id="badges" isChecked={draft.showBadges} onChange={(event) => patch({ showBadges: event.target.checked })} />
                    </FormControl>
                    <FormControl display="flex" alignItems="flex-start" justifyContent="space-between" gap={4}>
                      <Box>
                        <FormLabel htmlFor="lookup" mb={1}>
                          同じいちぽるのリンク先も読む
                        </FormLabel>
                        <FormHelperText mt={0}>
                          オフのときは、今見ている表と、ページ自身が受け取った応答だけを使います。オンにすると行のリンク先を追加で開きます。外部には送りません。
                        </FormHelperText>
                      </Box>
                      <Switch
                        id="lookup"
                        isChecked={draft.allowSameOriginLookup}
                        onChange={(event) => patch({ allowSameOriginLookup: event.target.checked })}
                      />
                    </FormControl>
                  </Stack>
                </TabPanel>
                <TabPanel px={0}>
                  <Stack spacing={4}>
                    <Text fontSize="sm" color="gray.600">
                      一覧の背景色です。左端の線は、選んだ色から自動で濃くします。
                    </Text>
                    {(['own', 'other', 'common'] as const).map((key) => (
                      <ColorField
                        key={key}
                        label={CATEGORY_LABEL[key]}
                        value={draft.colors[key]}
                        onChange={(value) => patch({ colors: { ...draft.colors, [key]: value } })}
                      />
                    ))}
                  </Stack>
                </TabPanel>
                <TabPanel px={0}>
                  <RulesEditor rules={draft.rules} onChange={(rules) => patch({ rules })} />
                </TabPanel>
                <TabPanel px={0}>
                  <Trial draft={draft} />
                </TabPanel>
              </TabPanels>
            </Tabs>
            {error && (
              <Alert status="error" mt={3} borderRadius="md">
                <AlertIcon />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Text mt={4} fontSize="xs" color="gray.500">
              科目データ、クッキー、ページの内容を外部のサーバへ送る処理はありません。
            </Text>
          </ModalBody>
          <ModalFooter gap={3}>
            <Text flex="1" fontSize="sm" color="green.700" aria-live="polite">
              {status}
            </Text>
            <Button variant="ghost" onClick={() => setResetOpen(true)}>
              初期状態に戻す
            </Button>
            <Button id="save-settings" colorScheme="ink" onClick={() => void save()}>
              保存する
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <AlertDialog isOpen={resetOpen} leastDestructiveRef={cancelRef} onClose={() => setResetOpen(false)} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent mx={3}>
            <AlertDialogHeader>初期状態に戻す</AlertDialogHeader>
            <AlertDialogBody>学部・学科・色・上書きルールを初期値に戻します。保存するまでいちぽるには反映されません。</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} variant="ghost" onClick={() => setResetOpen(false)}>
                やめる
              </Button>
              <Button
                colorScheme="red"
                ml={3}
                onClick={() => {
                  setDraft(defaultSettings());
                  setFacultyCustom(false);
                  setDeptCustom(false);
                  setResetOpen(false);
                  setStatus('');
                }}
              >
                戻す
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <FormControl>
      <FormLabel>{label}</FormLabel>
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

function RulesEditor({ rules, onChange }: { rules: OverrideRule[]; onChange: (rules: OverrideRule[]) => void }) {
  const update = (index: number, partial: Partial<OverrideRule>) => {
    onChange(rules.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...partial } : rule)));
  };
  const move = (index: number, direction: -1 | 1) => {
    const next = [...rules];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    onChange(next);
  };

  return (
    <Stack spacing={3}>
      <Text fontSize="sm" color="gray.600">
        自動判定より先に使います。上にあるルールが優先です。たとえば科目名に「英語」を含むものを共通科目にできます。
      </Text>
      {rules.length === 0 && <Text color="gray.600">ルールはまだありません。自動判定だけを使います。</Text>}
      {rules.map((rule, index) => {
        const regexError = rule.match === 'regex' && rule.pattern.trim() !== '' && !validRegex(rule.pattern);
        return (
          <Box key={rule.id} borderWidth="1px" borderColor="gray.200" borderRadius="md" p={3}>
            <HStack mb={2}>
              <Switch
                aria-label={`ルール${index + 1}を有効にする`}
                isChecked={rule.enabled}
                onChange={(event) => update(index, { enabled: event.target.checked })}
              />
              <Text fontSize="sm">有効</Text>
              <Box flex="1" />
              <Button size="sm" variant="ghost" onClick={() => move(index, -1)} isDisabled={index === 0}>
                上へ
              </Button>
              <Button size="sm" variant="ghost" onClick={() => move(index, 1)} isDisabled={index === rules.length - 1}>
                下へ
              </Button>
              <Button size="sm" variant="ghost" colorScheme="red" onClick={() => onChange(rules.filter((_, ruleIndex) => ruleIndex !== index))}>
                削除
              </Button>
            </HStack>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2}>
              <Select
                aria-label="見る場所"
                value={rule.field}
                onChange={(event) => update(index, { field: event.target.value as RuleField })}
              >
                {(Object.keys(FIELD_LABEL) as RuleField[]).map((field) => (
                  <option key={field} value={field}>
                    {FIELD_LABEL[field]}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="比較方法"
                value={rule.match}
                onChange={(event) => update(index, { match: event.target.value as RuleMatch })}
              >
                {(Object.keys(MATCH_LABEL) as RuleMatch[]).map((match) => (
                  <option key={match} value={match}>
                    {MATCH_LABEL[match]}
                  </option>
                ))}
              </Select>
              <Input
                aria-label="パターン"
                value={rule.pattern}
                placeholder="例: 英語"
                onChange={(event) => update(index, { pattern: event.target.value })}
              />
              <Select
                aria-label="分類"
                value={rule.category}
                onChange={(event) => update(index, { category: event.target.value as CourseCategory })}
              >
                {(Object.keys(CATEGORY_LABEL) as CourseCategory[]).map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABEL[category]}
                  </option>
                ))}
              </Select>
            </SimpleGrid>
            {regexError && (
              <Text mt={2} fontSize="sm" color="red.600">
                この正規表現は読めません。
              </Text>
            )}
          </Box>
        );
      })}
      <Button
        alignSelf="flex-start"
        variant="outline"
        colorScheme="ink"
        isDisabled={rules.length >= 40}
        onClick={() =>
          onChange([
            ...rules,
            { id: createRuleId(), enabled: true, field: 'name', match: 'includes', pattern: '', category: 'common' },
          ])
        }
      >
        ルールを追加
      </Button>
    </Stack>
  );
}

function Trial({ draft }: { draft: Settings }) {
  const [name, setName] = useState('プログラミング言語論');
  const [department, setDepartment] = useState('情報科学部 情報工学科');
  const [division, setDivision] = useState('専門科目');
  const result = classify({ name, department, division }, draft);
  const label = result.category === 'unknown' ? '未判定' : CATEGORY_LABEL[result.category];
  const color = result.category === 'unknown' ? '#e7e2d8' : draft.colors[result.category];

  return (
    <Stack spacing={3}>
      <Text fontSize="sm" color="gray.600">
        保存前の設定で、入力した科目がどの色になるか確認できます。ここでの入力は保存されません。
      </Text>
      <FormControl>
        <FormLabel htmlFor="trial-name">科目名</FormLabel>
        <Input id="trial-name" value={name} onChange={(event) => setName(event.target.value)} />
      </FormControl>
      <FormControl>
        <FormLabel htmlFor="trial-dept">開講学科</FormLabel>
        <Input id="trial-dept" value={department} onChange={(event) => setDepartment(event.target.value)} />
      </FormControl>
      <FormControl>
        <FormLabel htmlFor="trial-div">科目区分</FormLabel>
        <Input id="trial-div" value={division} onChange={(event) => setDivision(event.target.value)} />
      </FormControl>
      <HStack>
        <Badge px={3} py={1} borderRadius="full" bg={color} color="#1c2430" textTransform="none">
          {label}
        </Badge>
        <Text fontSize="sm">{reasonLabel(result, draft)}</Text>
      </HStack>
    </Stack>
  );
}

function validRegex(pattern: string): boolean {
  try {
    new RegExp(pattern, 'u');
    return true;
  } catch {
    return false;
  }
}
