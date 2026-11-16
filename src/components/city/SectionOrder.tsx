import { Button, Group, Modal, Text } from '@mantine/core';

import { t } from '../../i18n';
import { useUiStore } from '../../stores/uiStore';
import { completeOrder, sectionTitle } from '../../utils/citySections';
import { ReorderList, ReorderRow } from '../ReorderList';

import type { ReactElement } from 'react';

export function SectionOrder(): ReactElement {
  const opened = useUiStore((s) => s.sectionOrderOpen);
  const setOpen = useUiStore((s) => s.setSectionOrderOpen);
  const stored = useUiStore((s) => s.sectionOrder);
  const setOrder = useUiStore((s) => s.setSectionOrder);
  const reset = useUiStore((s) => s.resetSectionOrder);
  const order = completeOrder(stored);
  const close = () => { setOpen(false); };
  return (
    <Modal opened={opened} onClose={close} fullScreen title={t('city.order.title')} styles={{ body: { padding: 0 } }}
      closeButtonProps={{ size: 44, iconSize: 20, 'aria-label': t('common.close') }}>
      <Text px={20} pt={12} pb={16} fz={13} c="dimmed">{t('city.order.hint')}</Text>
      <ReorderList values={order} onReorder={setOrder}>
        {order.map((id) => {
          const title = sectionTitle(id);
          return (
            <ReorderRow key={id} value={id} label={t('city.order.move', { name: title })}>
              <Text fz={22} fw={800} py={16} pr={12} truncate="end" style={{ flex: 1, minWidth: 0 }}>{title}</Text>
            </ReorderRow>
          );
        })}
      </ReorderList>
      <Group grow gap={4} wrap="nowrap" p={12}>
        <Button variant="default" onClick={reset}>{t('city.order.reset')}</Button>
        <Button onClick={close}>{t('city.order.done')}</Button>
      </Group>
    </Modal>
  );
}
