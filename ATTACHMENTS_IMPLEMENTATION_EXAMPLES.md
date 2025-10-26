# Ant Design X Attachments - Practical Implementation Examples

## Quick Reference Table

| Use Case | Key Props | Example |
|----------|-----------|---------|
| Basic upload | `items`, `onChange` | See Pattern 1 |
| With validation | Add `beforeUpload` | See Pattern 2 |
| With Sender | Add `getDropContainer` | See Pattern 3 |
| Mock/No upload | `beforeUpload={() => false}` | See Pattern 4 |
| Custom icons | `Attachments.FileCard` | See Pattern 5 |
| Scrollable list | `overflow="scrollX"` | See Pattern 6 |
| Fullscreen drop | `getDropContainer={() => document.body}` | See Pattern 7 |

---

## Implementation Pattern 1: Basic File Upload

Minimal working example with state management.

```typescript
'use client'; // if using Next.js

import { Attachments, type AttachmentsProps } from '@ant-design/x';
import { CloudUploadOutlined } from '@ant-design/icons';
import { App } from 'antd';
import { useState, useRef, useEffect } from 'react';
import type { GetProp } from 'antd';

export const BasicAttachments = () => {
  const [items, setItems] = useState<GetProp<AttachmentsProps, 'items'>>([]);
  const { message } = App.useApp();
  const attachmentsRef = useRef<any>(null);

  // Handle file additions/changes
  const handleChange: GetProp<AttachmentsProps, 'onChange'> = ({
    file,
    fileList,
  }) => {
    // Create preview URL for new files
    const updatedList = fileList.map((item) => {
      if (item.uid === file.uid && item.originFileObj) {
        // Only create new URL if one doesn't exist
        return {
          ...item,
          url: item.url || URL.createObjectURL(item.originFileObj),
        };
      }
      return item;
    });

    setItems(updatedList);
    message.success(`${file.name} added`);
  };

  // Handle file removal
  const handleRemove = (item: any) => {
    // Clean up blob URL to prevent memory leak
    if (item.url?.startsWith('blob:')) {
      URL.revokeObjectURL(item.url);
    }
    message.info(`${item.name} removed`);
  };

  // Cleanup on unmount - CRITICAL for memory management
  useEffect(() => {
    return () => {
      items.forEach((item) => {
        if (item.url?.startsWith('blob:')) {
          URL.revokeObjectURL(item.url);
        }
      });
    };
  }, []);

  return (
    <Attachments
      ref={attachmentsRef}
      items={items}
      onChange={handleChange}
      onRemove={handleRemove}
      placeholder={{
        icon: <CloudUploadOutlined />,
        title: 'Upload Files',
        description: 'Click or drag files to this area to upload',
      }}
    />
  );
};
```

**Key Points:**
- `items` tracks current files in state
- `onChange` updates state and creates blob URLs
- `onRemove` cleans up blob URLs
- `useEffect` cleanup prevents memory leaks

---

## Implementation Pattern 2: With File Validation

Validate file size, type, and count before acceptance.

```typescript
'use client';

import { Attachments, type AttachmentsProps } from '@ant-design/x';
import { CloudUploadOutlined } from '@ant-design/icons';
import { App } from 'antd';
import { useState, useEffect } from 'react';
import type { GetProp } from 'antd';

export const ValidatedAttachments = () => {
  const [items, setItems] = useState<GetProp<AttachmentsProps, 'items'>>([]);
  const { message } = App.useApp();

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const MAX_FILES = 5;
  const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  const handleChange: GetProp<AttachmentsProps, 'onChange'> = ({
    file,
    fileList,
  }) => {
    const updatedList = fileList.map((item) => {
      if (item.uid === file.uid && item.originFileObj) {
        return {
          ...item,
          url: item.url || URL.createObjectURL(item.originFileObj),
        };
      }
      return item;
    });

    setItems(updatedList);
  };

  const handleBeforeUpload = (file: File): boolean => {
    // Size validation
    if (file.size > MAX_FILE_SIZE) {
      message.error(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
      return false;
    }

    // Type validation
    if (!ALLOWED_TYPES.includes(file.type)) {
      message.error(`File type not allowed. Supported: ${ALLOWED_TYPES.join(', ')}`);
      return false;
    }

    // Count validation
    if (items.length >= MAX_FILES) {
      message.error(`Maximum ${MAX_FILES} files allowed`);
      return false;
    }

    return true;
  };

  const handleRemove = (item: any) => {
    if (item.url?.startsWith('blob:')) {
      URL.revokeObjectURL(item.url);
    }
  };

  useEffect(() => {
    return () => {
      items.forEach((item) => {
        if (item.url?.startsWith('blob:')) {
          URL.revokeObjectURL(item.url);
        }
      });
    };
  }, [items]);

  return (
    <Attachments
      items={items}
      onChange={handleChange}
      onRemove={handleRemove}
      beforeUpload={handleBeforeUpload}
      maxCount={MAX_FILES}
      placeholder={{
        icon: <CloudUploadOutlined />,
        title: 'Upload Documents',
        description: `Max ${MAX_FILES} files, ${MAX_FILE_SIZE / 1024 / 1024}MB per file`,
      }}
    />
  );
};
```

**Validation Checks:**
- File size limits
- File type whitelist
- Maximum file count
- All validations show error messages

---

## Implementation Pattern 3: Integration with Sender

Complete chat interface with attachments.

```typescript
'use client';

import { Attachments, Sender, type AttachmentsProps } from '@ant-design/x';
import { CloudUploadOutlined, LinkOutlined } from '@ant-design/icons';
import { App, Badge, Button, type GetRef } from 'antd';
import { useState, useRef, useEffect } from 'react';
import type { GetProp } from 'antd';

export const SenderWithAttachments = () => {
  const [open, setOpen] = useState(true);
  const [items, setItems] = useState<GetProp<AttachmentsProps, 'items'>>([]);
  const [text, setText] = useState('');
  const senderRef = useRef<GetRef<typeof Sender>>(null);
  const { notification } = App.useApp();

  const handleChange: GetProp<AttachmentsProps, 'onChange'> = ({
    file,
    fileList,
  }) => {
    const updatedList = fileList.map((item) => {
      if (item.uid === file.uid && item.originFileObj) {
        // Revoke old URL if exists
        if (item.url?.startsWith('blob:')) {
          URL.revokeObjectURL(item.url);
        }
        return {
          ...item,
          url: URL.createObjectURL(item.originFileObj),
        };
      }
      return item;
    });

    setItems(updatedList);
  };

  const handleRemove = (item: any) => {
    if (item.url?.startsWith('blob:')) {
      URL.revokeObjectURL(item.url);
    }
  };

  const handleSubmit = () => {
    if (!text && items.length === 0) {
      notification.warning({
        message: 'Empty Message',
        description: 'Please enter text or attach files',
      });
      return;
    }

    // Here you would send the message + attachments to server
    notification.success({
      message: 'Message Sent',
      description: `Text: "${text}" with ${items.length} attachment(s)`,
    });

    // Reset state
    items.forEach((item) => {
      if (item.url?.startsWith('blob:')) {
        URL.revokeObjectURL(item.url);
      }
    });
    setItems([]);
    setText('');
  };

  useEffect(() => {
    return () => {
      items.forEach((item) => {
        if (item.url?.startsWith('blob:')) {
          URL.revokeObjectURL(item.url);
        }
      });
    };
  }, [items]);

  const senderHeader = (
    <Sender.Header
      title="Attachments"
      open={open}
      onOpenChange={setOpen}
      styles={{
        content: {
          padding: 0,
        },
      }}
    >
      <Attachments
        beforeUpload={() => false} // Mock upload - no server
        items={items}
        onChange={handleChange}
        onRemove={handleRemove}
        placeholder={(type) =>
          type === 'drop'
            ? { title: 'Drop file here' }
            : {
                icon: <CloudUploadOutlined />,
                title: 'Upload files',
                description: 'Click or drag files to this area to upload',
              }
        }
        // Critical: use senderRef to enable drop in Sender area
        getDropContainer={() => senderRef.current?.nativeElement}
      />
    </Sender.Header>
  );

  return (
    <Sender
      ref={senderRef}
      header={senderHeader}
      prefix={
        // Show badge when files are attached and panel is closed
        <Badge dot={items.length > 0 && !open}>
          <Button
            onClick={() => setOpen(!open)}
            icon={<LinkOutlined />}
            title="Toggle attachments"
          />
        </Badge>
      }
      value={text}
      onChange={setText}
      onSubmit={handleSubmit}
      placeholder="Type your message..."
    />
  );
};
```

**Key Integration Points:**
- `getDropContainer={() => senderRef.current?.nativeElement}` enables drag-drop in Sender
- `Sender.Header` wraps Attachments component
- Badge shows attachment count when panel is closed
- `beforeUpload={() => false}` prevents server upload

---

## Implementation Pattern 4: Mock Upload (No Server)

Development-friendly pattern without backend server.

```typescript
'use client';

import { Attachments, type AttachmentsProps } from '@ant-design/x';
import { CloudUploadOutlined } from '@ant-design/icons';
import { App } from 'antd';
import { useState, useEffect } from 'react';
import type { GetProp } from 'antd';

export const MockUploadAttachments = () => {
  const [items, setItems] = useState<GetProp<AttachmentsProps, 'items'>>([]);
  const { message } = App.useApp();

  const handleChange: GetProp<AttachmentsProps, 'onChange'> = ({
    file,
    fileList,
  }) => {
    // Simulate upload progress
    const updatedList = fileList.map((item) => {
      if (item.uid === file.uid) {
        // Create blob URL for preview
        if (item.originFileObj && !item.url) {
          return {
            ...item,
            url: URL.createObjectURL(item.originFileObj),
            status: 'done', // Mark as done immediately
            percent: 100,
          };
        }
      }
      return item;
    });

    setItems(updatedList);
  };

  const handleRemove = (item: any) => {
    if (item.url?.startsWith('blob:')) {
      URL.revokeObjectURL(item.url);
    }
  };

  useEffect(() => {
    return () => {
      items.forEach((item) => {
        if (item.url?.startsWith('blob:')) {
          URL.revokeObjectURL(item.url);
        }
      });
    };
  }, [items]);

  return (
    <Attachments
      items={items}
      onChange={handleChange}
      onRemove={handleRemove}
      // beforeUpload={() => false} prevents any upload attempt
      beforeUpload={() => false}
      placeholder={{
        icon: <CloudUploadOutlined />,
        title: 'Select Files (Mock)',
        description: 'Files are not uploaded anywhere - for testing only',
      }}
    />
  );
};
```

**Use Cases:**
- Development/testing without backend
- UI-only file selection
- Prototyping

---

## Implementation Pattern 5: Custom File Card Icons

Display files with custom or preset icons.

```typescript
'use client';

import { Attachments } from '@ant-design/x';
import { RobotOutlined, CopyFilled } from '@ant-design/icons';

interface FileItem {
  uid: string;
  name: string;
  size: number;
  type?: 'file' | 'image';
  icon?: 'pdf' | 'excel' | 'word' | 'image' | 'zip' | React.ReactNode;
}

export const CustomIconAttachments = () => {
  const files: FileItem[] = [
    {
      uid: '1',
      name: 'report.pdf',
      size: 1024000,
      icon: 'pdf',
      type: 'file',
    },
    {
      uid: '2',
      name: 'data.xlsx',
      size: 512000,
      icon: 'excel',
      type: 'file',
    },
    {
      uid: '3',
      name: 'document.docx',
      size: 256000,
      icon: 'word',
      type: 'file',
    },
    {
      uid: '4',
      name: 'image.png',
      size: 2048000,
      icon: 'image',
      type: 'image',
    },
    {
      uid: '5',
      name: 'archive.zip',
      size: 5120000,
      icon: 'zip',
      type: 'file',
    },
    // Custom icon example
    {
      uid: '6',
      name: 'model.pkl',
      size: 1024000,
      icon: <RobotOutlined style={{ color: '#1677ff' }} />,
      type: 'file',
    },
    {
      uid: '7',
      name: 'config.json',
      size: 4096,
      icon: <CopyFilled style={{ color: '#faad14' }} />,
      type: 'file',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {files.map((file) => (
        <Attachments.FileCard
          key={file.uid}
          item={file}
          type={file.type}
          icon={file.icon}
        />
      ))}
    </div>
  );
};
```

**Icon Options:**
- Preset strings: 'pdf', 'excel', 'word', 'image', 'zip', etc.
- Custom React components
- Ant Design Icons

---

## Implementation Pattern 6: Scrollable File List

Handle many files with overflow scrolling.

```typescript
'use client';

import { Attachments, type AttachmentsProps } from '@ant-design/x';
import { useState, useEffect } from 'react';
import type { GetProp } from 'antd';

export const ScrollableAttachments = () => {
  const [items, setItems] = useState<GetProp<AttachmentsProps, 'items'>>([]);

  const handleChange: GetProp<AttachmentsProps, 'onChange'> = ({
    fileList,
  }) => {
    const updatedList = fileList.map((item) => {
      if (item.originFileObj && !item.url) {
        return {
          ...item,
          url: URL.createObjectURL(item.originFileObj),
        };
      }
      return item;
    });

    setItems(updatedList);
  };

  const handleRemove = (item: any) => {
    if (item.url?.startsWith('blob:')) {
      URL.revokeObjectURL(item.url);
    }
  };

  useEffect(() => {
    return () => {
      items.forEach((item) => {
        if (item.url?.startsWith('blob:')) {
          URL.revokeObjectURL(item.url);
        }
      });
    };
  }, [items]);

  return (
    <div>
      {/* Horizontal scroll with navigation buttons */}
      <h3>Horizontal Scroll</h3>
      <Attachments
        items={items}
        onChange={handleChange}
        onRemove={handleRemove}
        overflow="scrollX"
        style={{ maxWidth: '600px' }}
      />

      {/* Vertical scroll */}
      <h3 style={{ marginTop: '32px' }}>Vertical Scroll</h3>
      <Attachments
        items={items}
        onChange={handleChange}
        onRemove={handleRemove}
        overflow="scrollY"
        style={{ maxHeight: '300px' }}
      />

      {/* Wrap to multiple rows */}
      <h3 style={{ marginTop: '32px' }}>Wrap</h3>
      <Attachments
        items={items}
        onChange={handleChange}
        onRemove={handleRemove}
        overflow="wrap"
      />
    </div>
  );
};
```

**Overflow Modes:**
- `scrollX`: Horizontal scroll with left/right buttons
- `scrollY`: Vertical scroll
- `wrap`: Wraps to new rows (default)

---

## Implementation Pattern 7: Server Upload Integration

Upload files to your backend server.

```typescript
'use client';

import { Attachments, type AttachmentsProps } from '@ant-design/x';
import { CloudUploadOutlined } from '@ant-design/icons';
import { App, Progress } from 'antd';
import { useState, useEffect } from 'react';
import type { GetProp } from 'antd';

export const ServerUploadAttachments = () => {
  const [items, setItems] = useState<GetProp<AttachmentsProps, 'items'>>([]);
  const { message } = App.useApp();

  const handleChange: GetProp<AttachmentsProps, 'onChange'> = ({
    file,
    fileList,
    event,
  }) => {
    // Update progress percentage if available
    const updatedList = fileList.map((item) => {
      if (item.uid === file.uid && event?.percent) {
        return {
          ...item,
          percent: Math.round(event.percent),
        };
      }
      return item;
    });

    setItems(updatedList);

    // Log upload progress
    if (file.status === 'done') {
      message.success(`${file.name} uploaded successfully`);
    } else if (file.status === 'error') {
      message.error(`${file.name} upload failed`);
    }
  };

  const handleBeforeUpload = (file: File): boolean => {
    // Validate before upload attempt
    const MAX_SIZE = 100 * 1024 * 1024; // 100MB
    if (file.size > MAX_SIZE) {
      message.error('File too large');
      return false;
    }
    return true;
  };

  const handleRemove = (item: any) => {
    if (item.url?.startsWith('blob:')) {
      URL.revokeObjectURL(item.url);
    }
  };

  useEffect(() => {
    return () => {
      items.forEach((item) => {
        if (item.url?.startsWith('blob:')) {
          URL.revokeObjectURL(item.url);
        }
      });
    };
  }, [items]);

  return (
    <Attachments
      items={items}
      onChange={handleChange}
      onRemove={handleRemove}
      beforeUpload={handleBeforeUpload}
      // Server configuration
      action="/api/upload" // Your upload endpoint
      method="POST"
      name="file" // Parameter name on server
      headers={{
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_API_TOKEN}`,
      }}
      // Progress tracking
      onProgress={(info) => {
        const { percent } = info.percent || 0;
        // Optional: show overall progress
      }}
      onSuccess={(response, file) => {
        // Handle successful upload response
        console.log('Upload response:', response);
      }}
      onError={(error, file) => {
        // Handle upload error
        console.error('Upload error:', error);
      }}
      placeholder={{
        icon: <CloudUploadOutlined />,
        title: 'Upload to Server',
        description: 'Files will be uploaded to server, max 100MB',
      }}
    />
  );
};
```

**Server Endpoint Example (Next.js):**

```typescript
// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return NextResponse.json(
      { error: 'No file provided' },
      { status: 400 }
    );
  }

  // Process file (save to storage, virus scan, etc.)
  const fileName = file.name;
  const fileSize = file.size;

  // Return response that matches Ant Upload expectations
  return NextResponse.json({
    success: true,
    message: 'File uploaded successfully',
    data: {
      fileName,
      fileSize,
      url: `/uploads/${fileName}`, // URL to access the file
    },
  });
}
```

---

## Error Handling Checklist

```typescript
// 1. File size validation
beforeUpload={(file) => file.size < 10 * 1024 * 1024}

// 2. File type validation
beforeUpload={(file) => ALLOWED_TYPES.includes(file.type)}

// 3. Max files validation
beforeUpload={() => items.length < MAX_FILES}

// 4. Memory leak prevention
useEffect(() => {
  return () => {
    items.forEach((item) => {
      if (item.url?.startsWith('blob:')) {
        URL.revokeObjectURL(item.url);
      }
    });
  };
}, [items]);

// 5. Removal cleanup
onRemove={(item) => {
  if (item.url?.startsWith('blob:')) {
    URL.revokeObjectURL(item.url);
  }
}}

// 6. Server error handling
onError={(error) => {
  message.error('Upload failed: ' + error.message);
}}
```

---

## Type Safety Tips

```typescript
import type {
  AttachmentsProps,
  AttachmentsRef,
  Attachment,
} from '@ant-design/x';
import type { GetProp, GetRef } from 'antd';

// Type for items array
type AttachmentsList = GetProp<AttachmentsProps, 'items'>;

// Type for onChange callback
type OnChangeCallback = GetProp<AttachmentsProps, 'onChange'>;

// Type for ref
type AttachmentsRefType = GetRef<typeof Attachments>;

// Using in component
const [items, setItems] = useState<AttachmentsList>([]);
const attachmentsRef = useRef<AttachmentsRefType>(null);

const handleChange: OnChangeCallback = ({ file, fileList }) => {
  // Now fully typed!
};
```
