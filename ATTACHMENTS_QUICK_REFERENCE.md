# Ant Design X Attachments - Quick Reference Card

## Essential Props (in priority order)

```typescript
<Attachments
  // 1. STATE MANAGEMENT (REQUIRED)
  items={items}                           // Current file list
  onChange={handleChange}                 // Update state on file change

  // 2. UPLOAD CONTROL
  beforeUpload={validateFile}            // Validate before upload
  onRemove={cleanupFile}                 // Handle removal & cleanup
  maxCount={5}                           // Max files allowed
  
  // 3. VALIDATION & BEHAVIOR
  disabled={false}                       // Disable upload
  accept=".pdf,.jpg,.png"                // File types allowed
  multiple={true}                        // Multiple files
  
  // 4. UI CUSTOMIZATION
  placeholder={{
    icon: <Icon />,
    title: 'Upload',
    description: 'Drag files here'
  }}
  getDropContainer={() => container}     // Where to drop files
  overflow="scrollX"                      // Overflow behavior
  
  // 5. STYLING
  className="custom-class"
  style={{ margin: '10px' }}
  classNames={{ list: 'my-list' }}
  styles={{ placeholder: { minHeight: '300px' } }}
/>
```

---

## Core State Pattern

```typescript
// 1. Define state
const [items, setItems] = useState<Attachment[]>([]);

// 2. Handle changes
const handleChange = ({ file, fileList }) => {
  const updated = fileList.map(item => ({
    ...item,
    url: item.url || URL.createObjectURL(item.originFileObj)
  }));
  setItems(updated);
};

// 3. Handle removal
const handleRemove = (item) => {
  if (item.url?.startsWith('blob:')) {
    URL.revokeObjectURL(item.url);
  }
};

// 4. Cleanup on unmount
useEffect(() => {
  return () => {
    items.forEach(item => {
      if (item.url?.startsWith('blob:')) {
        URL.revokeObjectURL(item.url);
      }
    });
  };
}, [items]);
```

---

## Attachment Object Structure

```typescript
interface Attachment {
  uid: string;              // Unique ID
  name: string;             // File name
  size?: number;            // File size (bytes)
  type?: string;            // MIME type
  url?: string;             // Display URL (blob: or http:)
  thumbUrl?: string;        // Thumbnail URL
  originFileObj?: File;     // Native File object
  status?: 'done' | 'uploading' | 'error' | 'removed';
  percent?: number;         // Upload progress (0-100)
  response?: any;           // Server response
  description?: React.ReactNode; // Custom text
}
```

---

## Common Patterns

### Pattern: Basic Upload
```typescript
<Attachments
  items={items}
  onChange={({ fileList }) => setItems(fileList)}
  placeholder={{ title: 'Upload files' }}
/>
```

### Pattern: With Validation
```typescript
<Attachments
  items={items}
  onChange={handleChange}
  beforeUpload={(file) => {
    if (file.size > 10 * 1024 * 1024) {
      message.error('File too large');
      return false;
    }
    return true;
  }}
/>
```

### Pattern: With Sender
```typescript
<Attachments
  items={items}
  onChange={handleChange}
  getDropContainer={() => senderRef.current?.nativeElement}
/>
```

### Pattern: Mock Upload (No Server)
```typescript
<Attachments
  items={items}
  onChange={handleChange}
  beforeUpload={() => false}  // Prevents server upload
/>
```

### Pattern: Server Upload
```typescript
<Attachments
  items={items}
  onChange={handleChange}
  action="/api/upload"
  method="POST"
  onSuccess={(res, file) => console.log(res)}
/>
```

---

## File Type Detection

### Preset Icons (Auto-Detect by Extension)
```
'pdf'      → .pdf
'excel'    → .xlsx, .xls
'word'     → .doc, .docx
'ppt'      → .ppt, .pptx
'markdown' → .md, .mdx
'image'    → .png, .jpg, .jpeg, .gif, .bmp, .webp, .svg
'zip'      → .zip, .rar, .7z, .tar, .gz
'video'    → .mp4, .avi, .mov, .wmv, .flv, .mkv
'audio'    → .mp3, .wav, .flac, .ape, .aac, .ogg
'default'  → Other files
```

### Custom Icon
```typescript
<Attachments.FileCard
  item={file}
  icon={<CustomIcon />}  // React component
  // OR
  icon="pdf"             // Preset string
/>
```

---

## Blob URL Management (CRITICAL!)

### Create Preview URL
```typescript
const url = URL.createObjectURL(file);  // file: File object
```

### Revoke/Cleanup
```typescript
URL.revokeObjectURL(url);  // MUST do this or memory leak!
```

### Pattern: Lifecycle
```typescript
// Create: In onChange handler
const newUrl = URL.createObjectURL(originFileObj);

// Store: In items state
items = [{ url: newUrl, ... }]

// Revoke: In onRemove or cleanup
useEffect(() => {
  return () => {
    items.forEach(item => {
      if (item.url?.startsWith('blob:')) {
        URL.revokeObjectURL(item.url);
      }
    });
  };
}, [items]);
```

---

## Placeholder Variations

### Static
```typescript
placeholder={{
  icon: <CloudUploadOutlined />,
  title: 'Upload Files',
  description: 'Drag files here'
}}
```

### Dynamic (Different for inline vs drop)
```typescript
placeholder={(type) =>
  type === 'drop'
    ? { title: 'Drop here!' }
    : {
        icon: <CloudUploadOutlined />,
        title: 'Click to upload'
      }
}
```

### Custom Element
```typescript
placeholder={
  <div>
    <Icon /> <p>Custom UI</p>
  </div>
}
```

---

## Overflow Handling

```typescript
// Horizontal scroll with nav buttons
overflow="scrollX"

// Vertical scroll
overflow="scrollY"

// Wrap to new rows (default)
overflow="wrap"
```

---

## Drop Container Configuration

### Default (Component Element)
```typescript
getDropContainer={() => undefined}
// Drop works only on component itself
```

### Specific Element
```typescript
const containerRef = useRef();
getDropContainer={() => containerRef.current}
// Drop works on containerRef
```

### Fullscreen
```typescript
getDropContainer={() => document.body}
// Drop works anywhere on page
```

### With Sender
```typescript
const senderRef = useRef();
<Attachments
  getDropContainer={() => senderRef.current?.nativeElement}
/>
// Drop works on entire Sender component
```

---

## Validation Examples

### File Size
```typescript
beforeUpload={(file) => {
  const isSmall = file.size / 1024 / 1024 < 10;
  if (!isSmall) message.error('Too large');
  return isSmall;
}}
```

### File Type
```typescript
beforeUpload={(file) => {
  const allowed = ['image/jpeg', 'image/png'];
  const ok = allowed.includes(file.type);
  if (!ok) message.error('Not allowed');
  return ok;
}}
```

### Max Count
```typescript
beforeUpload={() => {
  if (items.length >= 5) {
    message.error('Max 5 files');
    return false;
  }
  return true;
}}
```

### Async Validation
```typescript
beforeUpload={async (file) => {
  const isValid = await checkFileOnServer(file);
  return isValid;
}}
```

---

## Ref Access

```typescript
const attachmentsRef = useRef<any>(null);

// Get native DOM element
const domElement = attachmentsRef.current?.nativeElement;

// Programmatically upload file
const fileInput = document.querySelector('input[type="file"]');
attachmentsRef.current?.upload(fileInput.files[0]);
```

---

## File Card Component

```typescript
// Individual file display
<Attachments.FileCard
  item={file}           // Attachment object
  type="file"          // 'file' or 'image'
  icon="pdf"           // Preset or custom
  onRemove={handleRemove}
/>
```

---

## TypeScript Types

```typescript
import type {
  AttachmentsProps,
  AttachmentsRef,
  Attachment,
} from '@ant-design/x';
import type { GetProp, GetRef } from 'antd';

// Type the items array
type Items = GetProp<AttachmentsProps, 'items'>;
const [items, setItems] = useState<Items>([]);

// Type the onChange callback
type OnChange = GetProp<AttachmentsProps, 'onChange'>;
const handleChange: OnChange = ({ fileList }) => {};

// Type the ref
type AttRef = GetRef<typeof Attachments>;
const attachmentsRef = useRef<AttRef>(null);
```

---

## Common Mistakes to Avoid

```typescript
// ❌ WRONG: Memory leak - blob URLs never revoked
const [items, setItems] = useState([]);
<Attachments items={items} onChange={({ fileList }) => setItems(fileList)} />

// ✅ RIGHT: Cleanup blob URLs
useEffect(() => {
  return () => {
    items.forEach(item => {
      if (item.url?.startsWith('blob:')) {
        URL.revokeObjectURL(item.url);
      }
    });
  };
}, [items]);

// ❌ WRONG: Using blob URL after removal
const [items, setItems] = useState([]);
// URL revoked but still in state

// ✅ RIGHT: Revoke before updating state
onRemove={(item) => {
  if (item.url?.startsWith('blob:')) {
    URL.revokeObjectURL(item.url);
  }
  // Then state is updated by onChange
}}

// ❌ WRONG: No beforeUpload validation
<Attachments items={items} onChange={handleChange} />

// ✅ RIGHT: Validate early
<Attachments
  items={items}
  onChange={handleChange}
  beforeUpload={(file) => {
    // Validate before adding to state
    return file.size < 10 * 1024 * 1024;
  }}
/>
```

---

## Debug Checklist

- [ ] Is `items` prop controlled by useState?
- [ ] Is `onChange` callback updating items state?
- [ ] Are blob URLs being revoked in onRemove?
- [ ] Is useEffect cleanup revoking all blob URLs?
- [ ] Is beforeUpload returning boolean or Promise<boolean>?
- [ ] Is getDropContainer pointing to correct element?
- [ ] Are all TypeScript imports available?
- [ ] Is parent App component wrapping for notifications?

---

## Real-World Example

```typescript
'use client';

import { Attachments, Sender, type AttachmentsProps } from '@ant-design/x';
import { CloudUploadOutlined, LinkOutlined } from '@ant-design/icons';
import { App, Badge, Button } from 'antd';
import { useState, useRef, useEffect } from 'react';
import type { GetProp, GetRef } from 'antd';

export default function ChatWithFiles() {
  const [items, setItems] = useState<GetProp<AttachmentsProps, 'items'>>([]);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(true);
  const senderRef = useRef<GetRef<typeof Sender>>(null);
  const { message, notification } = App.useApp();

  const handleChange: GetProp<AttachmentsProps, 'onChange'> = ({
    file,
    fileList,
  }) => {
    const updated = fileList.map(item => {
      if (item.uid === file.uid && item.originFileObj) {
        return {
          ...item,
          url: item.url || URL.createObjectURL(item.originFileObj),
        };
      }
      return item;
    });
    setItems(updated);
  };

  const handleRemove = (item: any) => {
    if (item.url?.startsWith('blob:')) {
      URL.revokeObjectURL(item.url);
    }
  };

  const handleBeforeUpload = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      message.error('Max 10MB');
      return false;
    }
    return true;
  };

  const handleSubmit = () => {
    if (!text && items.length === 0) {
      message.warning('Empty message');
      return;
    }

    // Send message + files to server
    notification.success({
      message: 'Sent',
      description: `${text} + ${items.length} files`,
    });

    // Cleanup
    items.forEach(item => {
      if (item.url?.startsWith('blob:')) {
        URL.revokeObjectURL(item.url);
      }
    });
    setItems([]);
    setText('');
  };

  useEffect(() => {
    return () => {
      items.forEach(item => {
        if (item.url?.startsWith('blob:')) {
          URL.revokeObjectURL(item.url);
        }
      });
    };
  }, [items]);

  return (
    <Sender
      ref={senderRef}
      header={
        <Sender.Header title="Files" open={open} onOpenChange={setOpen}>
          <Attachments
            items={items}
            onChange={handleChange}
            onRemove={handleRemove}
            beforeUpload={handleBeforeUpload}
            beforeUpload={() => false}
            placeholder={(type) =>
              type === 'drop'
                ? { title: 'Drop here' }
                : {
                    icon: <CloudUploadOutlined />,
                    title: 'Upload',
                  }
            }
            getDropContainer={() => senderRef.current?.nativeElement}
          />
        </Sender.Header>
      }
      prefix={
        <Badge dot={items.length > 0 && !open}>
          <Button icon={<LinkOutlined />} onClick={() => setOpen(!open)} />
        </Badge>
      }
      value={text}
      onChange={setText}
      onSubmit={handleSubmit}
    />
  );
}
```

