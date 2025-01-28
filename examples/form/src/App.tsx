import { Button, MenuItem, Select, Stack, TextField } from '@mui/material';
import { createForm } from 'cross-state/react';
import './App.css';

const { Form, Field } = createForm<{ a: string; b: string }>({
  defaultValue: {
    a: '',
    b: '',
  },
  validations: {
    a: {
      minLength: (value) => value.length > 10,
    },
    b: {
      required: (value) => !!value,
    },
  },
});

export default function App() {
  return (
    <Form onSubmit={(_e, form) => form.reset()}>
      <Content />
    </Form>
  );
}

function Content() {
  return (
    <Stack gap={2}>
      <Field name="a" render={(props) => <TextField {...props} label="a" />} />

      <Field
        name="b"
        render={(props, { errors, hasTriggeredValidations }) => (
          <Select {...props} label="b" error={hasTriggeredValidations && errors.length > 0}>
            <MenuItem value="1">1</MenuItem>
            <MenuItem value="2">2</MenuItem>
          </Select>
        )}
      />

      <Button type="submit">Submit</Button>
    </Stack>
  );
}
