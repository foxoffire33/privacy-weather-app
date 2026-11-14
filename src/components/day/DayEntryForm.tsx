import { Box, Button, Drawer, Group, NumberInput, Select, SimpleGrid, TextInput } from '@mantine/core';
import { schemaResolver, useForm } from '@mantine/form';

import { t } from '../../i18n';
import { todayISO, useDayRecord, useLogStore, useUnits } from '../../stores';
import { dayEntryFrom, dayFormSchema, dayFormValues } from '../../utils/dayEntry';
import { windUnitLabel } from '../../utils/format';
import { conditionLabel, WEATHER_CODES } from '../../utils/weatherCodes';

import type { DayEntryFieldsProps, DayEntryFormProps, DayFormValues } from '../../types';
import type { ReactElement } from 'react';

function DayEntryFields({ cityId, date, onClose }: DayEntryFieldsProps): ReactElement {
  const units = useUnits();
  const today = todayISO();
  const record = useDayRecord(cityId, date ?? '');
  const saveDay = useLogStore((s) => s.saveDay);
  const form = useForm<DayFormValues>({
    mode: 'uncontrolled',
    initialValues: dayFormValues(date ?? today, record, units),
    validate: schemaResolver(dayFormSchema(units, today), { sync: true }),
  });
  const deg = units.temp === 'F' ? '°F' : '°C';
  const wind = windUnitLabel(units.wind);
  const conditions = WEATHER_CODES.map((code) => ({ value: String(code), label: conditionLabel(code) }));
  return (
    <Box component="form" noValidate onSubmit={form.onSubmit((values) => {
      saveDay(cityId, values.date, dayEntryFrom(values, units));
      onClose();
    })}>
      {date === undefined && (
        <TextInput type="date" label={t('dayForm.date')} max={today} mb="sm" key={form.key('date')} {...form.getInputProps('date')} />
      )}
      <SimpleGrid cols={2} spacing="sm">
        <NumberInput label={`${t('dayForm.high')} (${deg})`} decimalScale={1} key={form.key('hi')} {...form.getInputProps('hi')} />
        <NumberInput label={`${t('dayForm.low')} (${deg})`} decimalScale={1} key={form.key('lo')} {...form.getInputProps('lo')} />
        <NumberInput label={`${t('dayForm.feelsHigh')} (${deg})`} decimalScale={1} key={form.key('feelsHi')} {...form.getInputProps('feelsHi')} />
        <NumberInput label={`${t('dayForm.feelsLow')} (${deg})`} decimalScale={1} key={form.key('feelsLo')} {...form.getInputProps('feelsLo')} />
        <NumberInput label={`${t('dayForm.rain')} (mm)`} min={0} decimalScale={1} key={form.key('mm')} {...form.getInputProps('mm')} />
        <NumberInput label={`${t('dayForm.snow')} (cm)`} min={0} decimalScale={1} key={form.key('snow')} {...form.getInputProps('snow')} />
        <NumberInput label={`${t('dayForm.wind')} (${wind})`} min={0} decimalScale={1} key={form.key('wind')} {...form.getInputProps('wind')} />
        <NumberInput label={`${t('dayForm.gusts')} (${wind})`} min={0} decimalScale={1} key={form.key('gust')} {...form.getInputProps('gust')} />
        <NumberInput label={`${t('dayForm.sunshine')} (h)`} min={0} max={24} decimalScale={1} key={form.key('sunshine')} {...form.getInputProps('sunshine')} />
        <NumberInput label={t('dayForm.uv')} min={0} max={20} decimalScale={1} key={form.key('uv')} {...form.getInputProps('uv')} />
      </SimpleGrid>
      <Select mt="sm" label={t('dayForm.condition')} data={conditions} clearable searchable
        comboboxProps={{ withinPortal: false }} key={form.key('code')} {...form.getInputProps('code')} />
      <Group grow mt="lg" wrap="nowrap">
        <Button variant="outline" color="gray" onClick={onClose}>{t('common.cancel')}</Button>
        <Button type="submit">{t('dayForm.save')}</Button>
      </Group>
    </Box>
  );
}

export function DayEntryForm({ cityId, date, opened, onClose }: DayEntryFormProps): ReactElement {
  return (
    <Drawer opened={opened} onClose={onClose} title={date === undefined ? t('dayForm.createTitle') : t('dayForm.editTitle')}
      closeButtonProps={{ size: 44, iconSize: 20, 'aria-label': t('common.close') }}>
      {opened && <DayEntryFields cityId={cityId} date={date} onClose={onClose} />}
    </Drawer>
  );
}
