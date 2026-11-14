import { Box, Button, NumberInput, SimpleGrid, TextInput } from '@mantine/core';
import { schemaResolver, useForm } from '@mantine/form';

import { t } from '../../i18n';
import { followCity } from '../../stores';
import { cityFormSchema, EMPTY_CITY, geoFromForm } from '../../utils/cityEntry';

import type { CityFormValues, ManualCityFormProps } from '../../types';
import type { ReactElement } from 'react';

export function ManualCityForm({ onAdded }: ManualCityFormProps): ReactElement {
  const form = useForm<CityFormValues>({
    mode: 'uncontrolled',
    initialValues: EMPTY_CITY,
    validate: schemaResolver(cityFormSchema(), { sync: true }),
  });
  return (
    <Box component="form" noValidate onSubmit={form.onSubmit((values) => {
      onAdded(followCity(geoFromForm(values)));
    })}>
      <TextInput label={t('cityForm.name')} mb="sm" key={form.key('name')} {...form.getInputProps('name')} />
      <TextInput label={t('cityForm.region')} mb="sm" key={form.key('region')} {...form.getInputProps('region')} />
      <SimpleGrid cols={2} spacing="sm">
        <NumberInput label={t('cityForm.latitude')} decimalScale={4} min={-90} max={90} key={form.key('latitude')} {...form.getInputProps('latitude')} />
        <NumberInput label={t('cityForm.longitude')} decimalScale={4} min={-180} max={180} key={form.key('longitude')} {...form.getInputProps('longitude')} />
      </SimpleGrid>
      <Button type="submit" fullWidth mt="lg">{t('cityForm.add')}</Button>
    </Box>
  );
}
