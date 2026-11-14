import { Box, Loader, Stack, Text } from '@mantine/core';

import { t } from '../i18n';

import type { ReactElement } from 'react';

export function Splash(): ReactElement {
  return (
    <Box className="screen accent-field splash" role="status" aria-label={t('splash.loading')}>
      <Stack align="center" justify="center" gap="md" style={{ flex: 1 }}>
        <Box w={108} h={108} pos="relative" aria-hidden>
          <Box pos="absolute" left={27} top={21} w={54} h={54} style={{ border: '9px solid #fff', borderRadius: '50%' }} />
          <Box pos="absolute" left={15} top={63} w={78} h={9} bg="#fff" />
        </Box>
        <Text fz={28} fw={800}>{t('splash.name')}</Text>
        <Loader color="white" size="sm" type="dots" />
      </Stack>
    </Box>
  );
}
