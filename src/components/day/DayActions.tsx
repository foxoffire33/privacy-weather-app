import { Box, Button, Group, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { useState } from 'react';

import { t } from '../../i18n';
import { NO_ARCHIVE_DATA, restoreDay, useRestoreQuery, useSettings } from '../../stores';

import { DayEntryForm } from './DayEntryForm';

import type { DayActionsProps } from '../../types';
import type { ReactElement } from 'react';

export function DayActions({ cityId, date, record }: DayActionsProps): ReactElement {
  const [editing, setEditing] = useState(false);
  const restore = useRestoreQuery(cityId, date);
  const busy = restore.status === 'loading';
  const offline = useSettings().offline;
  const canRestore = record?.source === 'edited' && !offline;
  const confirmRestore = () => {
    modals.openConfirmModal({
      groupProps: { grow: true, wrap: 'nowrap', mt: 16 },
      children: t('dayView.restoreConfirm'),
      labels: { confirm: t('dayView.restore'), cancel: t('common.cancel') },
      onConfirm: () => void restoreDay(cityId, date),
    });
  };
  return (
    <Box px={12} pt={12}>
      <Group grow wrap="nowrap">
        <Button variant="outline" color="gray" onClick={() => { setEditing(true); }}>
          {record === undefined ? t('dayView.addToLog') : t('dayView.edit')}
        </Button>
        {canRestore && <Button variant="outline" color="gray" loading={busy} onClick={confirmRestore}>{t('dayView.restore')}</Button>}
      </Group>
      {restore.status === 'error' && (
        <Text fz={12} c="signal.3" mt={6} role="status">
          {restore.error === NO_ARCHIVE_DATA ? t('history.noArchive') : t('dayView.restoreFailed', { error: restore.error ?? '' })}
        </Text>
      )}
      <DayEntryForm cityId={cityId} date={date} opened={editing} onClose={() => { setEditing(false); }} />
    </Box>
  );
}
