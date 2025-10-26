# Ant Design X Attachments Component - Complete API Guide

## Table of Contents
1. [Core Component Types](#core-component-types)
2. [Main Component Props](#main-component-props)
3. [Attachment File Structure](#attachment-file-structure)
4. [Usage Patterns](#usage-patterns)
5. [Integration with Sender](#integration-with-sender)
6. [File Upload Handling](#file-upload-handling)
7. [Advanced Patterns](#advanced-patterns)

---

## Core Component Types

### AttachmentsProps Interface
```typescript
interface AttachmentsProps extends Omit<UploadProps, 'fileList'> {
  // CSS Configuration
  prefixCls?: string;
  rootClassName?: string;
  rootStyle?: React.CSSProperties;
  style?: React.CSSProperties;
  className?: string;
  
  // Semantic styling (list, item, placeholder, upload)
  classNames?: Partial<Record<SemanticType, string>>;
  styles?: Partial<Record<SemanticType, React.CSSProperties>>;

  // File Management
  items?: Attachment[];
  children?: React.ReactElement;
  disabled?: boolean;
  maxCount?: number;

  // UI Behavior
  placeholder?: PlaceholderType | ((type: 'inline' | 'drop') => PlaceholderType);
  getDropContainer?: null | (() => HTMLElement | null | undefined);
  overflow?: FileListProps['overflow'];
  imageProps?: FileListProps['imageProps'];
  
  // Inherited from UploadProps
  onChange?: (info: UploadChangeParam) => void;
  onRemove?: (item: Attachment) => boolean | Promise<boolean | void> | void;
  beforeUpload?: (file: File, fileList: File[]) => boolean | Promise<boolean>;
  // ... other Upload props
}
```

### AttachmentsRef Interface
```typescript
interface AttachmentsRef {
  nativeElement: HTMLDivElement | null;
  upload: (file: File) => void;  // Programmatically upload a file
}
```

### SemanticType
```typescript
type SemanticType = 'list' | 'item' | 'placeholder' | 'upload';
```

---

## Attachment File Structure

### Attachment Type Definition
```typescript
type Attachment = GetProp<UploadProps, 'fileList'>[number] & {
  description?: React.ReactNode;
};

// Expands to (from Ant Design Upload):
interface Attachment extends UploadFile {
  uid: string;           // Unique identifier
  name: string;          // File name
  size?: number;         // File size in bytes
  url?: string;          // URL for the file
  thumbUrl?: string;     // Thumbnail URL
  originFileObj?: File;  // Original File object
  status?: UploadFileStatus; // 'done' | 'uploading' | 'error' | 'removed'
  percent?: number;      // Upload progress (0-100) when uploading
  response?: any;        // Server response
  description?: React.ReactNode; // Custom description
}
```

### UploadFileStatus
```typescript
type UploadFileStatus = 'error' | 'success' | 'done' | 'uploading' | 'removed';
```

### FileListCardProps (Individual File Display)
```typescript
interface FileListCardProps {
  prefixCls?: string;
  item: Attachment;
  onRemove?: (item: Attachment) => void;
  className?: string;
  style?: React.CSSProperties;
  imageProps?: ImageProps;
  icon?: React.ReactNode | PresetIcons;
  type?: 'file' | 'image';
}

// Preset icon types
type PresetIcons = 
  | 'default'    // Generic document icon
  | 'excel'      // .xlsx, .xls
  | 'image'      // .png, .jpg, .jpeg, .gif, .bmp, .webp, .svg
  | 'markdown'   // .md, .mdx
  | 'pdf'        // .pdf
  | 'ppt'        // .ppt, .pptx
  | 'word'       // .doc, .docx
  | 'zip'        // .zip, .rar, .7z, .tar, .gz
  | 'video'      // .mp4, .avi, .mov, .wmv, .flv, .mkv
  | 'audio';     // .mp3, .wav, .flac, .ape, .aac, .ogg
```

---

## Main Component Props

### Essential Props for File Upload

#### `items` - File List State
```typescript
items?: Attachment[];
// Controlled file list - pass your state to display files
// Usually managed with useState and onChange callback
```

#### `onChange` - File Change Callback
```typescript
onChange?: (info: {
  file: UploadFile;
  fileList: UploadFile[];
  event?: ProgressEvent;
}) => void;

// Usage pattern:
const [items, setItems] = useState<Attachment[]>([]);

<Attachments
  items={items}
  onChange={({ file, fileList }) => {
    const updatedList = fileList.map(item => {
      if (item.uid === file.uid && item.originFileObj) {
        return {
          ...item,
          url: URL.createObjectURL(item.originFileObj)
        };
      }
      return item;
    });
    setItems(updatedList);
  }}
/>
```

#### `onRemove` - File Deletion Callback
```typescript
onRemove?: (item: Attachment) => boolean | Promise<boolean | void> | void;

// Return false or reject Promise to prevent removal
// Usage:
onRemove={(item) => {
  // Clean up blob URLs
  if (item.url?.startsWith('blob:')) {
    URL.revokeObjectURL(item.url);
  }
  // Optionally prevent removal:
  // return false;
}}
```

#### `beforeUpload` - Pre-Upload Validation
```typescript
beforeUpload?: (file: File, fileList: File[]) => 
  boolean | Promise<boolean>;

// Common patterns:
beforeUpload={(file) => {
  const isValidSize = file.size / 1024 / 1024 < 10;
  if (!isValidSize) {
    message.error('File must be smaller than 10MB');
  }
  return isValidSize;
}}

// Mock/prevent real upload:
beforeUpload={() => false} // Don't upload to server
```

#### `maxCount` - Maximum Files
```typescript
maxCount?: number;
// Limit number of files that can be uploaded
```

#### `accept` - File Type Acceptance
```typescript
accept?: string; // MIME types or extensions
// Examples:
accept="image/*"
accept=".pdf,.doc,.docx"
accept=".jpg,.jpeg,.png"
```

#### `disabled` - Disable Upload
```typescript
disabled?: boolean;
// Disables file input and prevents interactions
```

### Placeholder Configuration

#### `placeholder` - Empty State UI
```typescript
placeholder?: PlaceholderType | ((type: 'inline' | 'drop') => PlaceholderType);

interface PlaceholderConfig {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
}

type PlaceholderType = PlaceholderConfig | React.ReactElement;

// Usage with function for different types:
placeholder={(type) =>
  type === 'drop'
    ? { title: 'Drop file here' }
    : {
        icon: <CloudUploadOutlined />,
        title: 'Upload files',
        description: 'Click or drag files to this area'
      }
}
```

#### `getDropContainer` - Drag-Drop Area
```typescript
getDropContainer?: () => HTMLElement | null | undefined;

// Define where files can be dropped
// Examples:
getDropContainer={() => containerRef.current}  // Specific element
getDropContainer={() => document.body}         // Fullscreen drop
getDropContainer={() => senderRef.current?.nativeElement}  // With Sender
```

### File List Display

#### `overflow` - Overflow Behavior
```typescript
overflow?: 'scrollX' | 'scrollY' | 'wrap';
// scrollX: horizontal scroll with navigation buttons
// scrollY: vertical scroll
// wrap: wrap to next row
```

#### `imageProps` - Image Display Configuration
```typescript
imageProps?: ImageProps;
// Passed to antd Image component for preview
// Useful for customizing image display behavior
```

---

## Usage Patterns

### Pattern 1: Basic File Upload with State Management
```typescript
import { Attachments, type AttachmentsProps } from '@ant-design/x';
import { App } from 'antd';
import { GetProp, useState, useRef } from 'react';

const Demo = () => {
  const [items, setItems] = useState<GetProp<AttachmentsProps, 'items'>>([]);
  const { message } = App.useApp();
  const attachmentsRef = useRef<any>(null);

  const handleChange: GetProp<AttachmentsProps, 'onChange'> = ({ file, fileList }) => {
    // Create blob URL for preview
    const updatedFileList = fileList.map((item) => {
      if (item.uid === file.uid && item.originFileObj) {
        return {
          ...item,
          url: URL.createObjectURL(item.originFileObj),
        };
      }
      return item;
    });
    setItems(updatedFileList);
  };

  const handleRemove = (item: AttachmentsProps['items'][0]) => {
    // Clean up blob URLs
    if (item.url?.startsWith('blob:')) {
      URL.revokeObjectURL(item.url);
    }
  };

  // Cleanup on unmount
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
        description: 'Click or drag to upload',
      }}
    />
  );
};
```

### Pattern 2: Validation with beforeUpload
```typescript
<Attachments
  items={items}
  onChange={handleChange}
  beforeUpload={(file) => {
    // File size validation
    const isLt10MB = file.size / 1024 / 1024 < 10;
    if (!isLt10MB) {
      message.error('File must be smaller than 10MB!');
      return false;
    }

    // File type validation
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      message.error('Invalid file type!');
      return false;
    }

    return true;
  }}
/>
```

### Pattern 3: Mock Upload (No Server)
```typescript
// Common in development - prevent actual upload
<Attachments
  items={items}
  onChange={handleChange}
  beforeUpload={() => false} // Prevents upload to server
  placeholder={{
    icon: <CloudUploadOutlined />,
    title: 'Select Files',
  }}
/>
```

---

## Integration with Sender

### Complete Sender + Attachments Example
```typescript
import { Attachments, Sender, type AttachmentsProps } from '@ant-design/x';
import { App, Badge, Button, type GetRef } from 'antd';
import { CloudUploadOutlined, LinkOutlined } from '@ant-design/icons';
import { useState, useRef, useEffect } from 'react';

const ChatWithAttachments = () => {
  const [open, setOpen] = useState(true);
  const [items, setItems] = useState<GetProp<AttachmentsProps, 'items'>>([]);
  const [text, setText] = useState('');
  const senderRef = useRef<GetRef<typeof Sender>>(null);
  const { notification } = App.useApp();

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      items.forEach((item) => {
        if (item.url?.startsWith('blob:')) {
          URL.revokeObjectURL(item.url);
        }
      });
    };
  }, []);

  const senderHeader = (
    <Sender.Header
      title="Attachments"
      open={open}
      onOpenChange={setOpen}
    >
      <Attachments
        beforeUpload={() => false} // Mock upload
        items={items}
        onChange={({ file, fileList }) => {
          const updatedFileList = fileList.map((item) => {
            if (item.uid === file.uid && item.originFileObj) {
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
          setItems(updatedFileList);
        }}
        onRemove={(item) => {
          if (item.url?.startsWith('blob:')) {
            URL.revokeObjectURL(item.url);
          }
        }}
        placeholder={(type) =>
          type === 'drop'
            ? { title: 'Drop file here' }
            : {
                icon: <CloudUploadOutlined />,
                title: 'Upload files',
                description: 'Click or drag files here',
              }
        }
        getDropContainer={() => senderRef.current?.nativeElement}
      />
    </Sender.Header>
  );

  return (
    <Sender
      ref={senderRef}
      header={senderHeader}
      prefix={
        <Badge dot={items.length > 0 && !open}>
          <Button onClick={() => setOpen(!open)} icon={<LinkOutlined />} />
        </Badge>
      }
      value={text}
      onChange={setText}
      onSubmit={() => {
        // Send message with attachments
        notification.info({
          message: 'Message Sent',
          description: `Text: ${text}, Attachments: ${items.length}`,
        });
        setItems([]);
        setText('');
      }}
    />
  );
};
```

### Sender.Header Props
```typescript
interface SenderHeaderProps {
  title?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  styles?: {
    content?: React.CSSProperties;
  };
  children?: React.ReactNode;
}
```

---

## File Upload Handling

### State Management Pattern
```typescript
// Core state for attachments
const [items, setItems] = useState<Attachment[]>([]);

// On file change
const handleChange: GetProp<AttachmentsProps, 'onChange'> = 
  ({ file, fileList }) => {
    // fileList is the updated list with the new file
    
    // For blob preview URLs, create after file is added
    const updated = fileList.map(item => {
      if (item.originFileObj) {
        return {
          ...item,
          url: item.url || URL.createObjectURL(item.originFileObj)
        };
      }
      return item;
    });
    
    setItems(updated);
  };
```

### Blob URL Management
```typescript
// Create preview URL from file object
const createPreviewUrl = (file: File): string => {
  return URL.createObjectURL(file);
};

// Clean up when no longer needed (IMPORTANT!)
const revokePreviewUrl = (url: string) => {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};

// Cleanup pattern in useEffect
useEffect(() => {
  return () => {
    // Revoke all blob URLs on unmount
    items.forEach(item => {
      if (item.url?.startsWith('blob:')) {
        URL.revokeObjectURL(item.url);
      }
    });
  };
}, [items]);
```

### File Object Properties
```typescript
interface FileProperties {
  file: File {
    name: string;           // 'document.pdf'
    size: number;          // Bytes: 1024000
    type: string;          // MIME: 'application/pdf'
    lastModified: number;  // Timestamp
    slice(start, end): Blob; // For chunked upload
  }
}

// Accessing in attachment:
const { originFileObj } = attachment;
if (originFileObj) {
  console.log(originFileObj.name);
  console.log(originFileObj.size / 1024 / 1024, 'MB');
  console.log(originFileObj.type);
}
```

---

## Advanced Patterns

### Pattern 1: Custom File Card Display
```typescript
import { Attachments } from '@ant-design/x';

const Demo = () => {
  const filesList = [
    {
      uid: '1',
      name: 'document.pdf',
      size: 1024000,
      description: 'Important PDF',
    },
  ];

  return (
    <Attachments.FileCard
      item={filesList[0]}
      type="file"
      icon="pdf"
    />
  );
};
```

### Pattern 2: Custom Icons
```typescript
<Attachments.FileCard
  item={file}
  icon={<CustomIcon style={{ color: '#ff5722' }} />}
  type="file"
/>

// Or use preset icons:
<Attachments.FileCard
  item={file}
  icon="excel"  // Automatic styling for Excel
  type="file"
/>
```

### Pattern 3: Image Preview Mode
```typescript
<Attachments.FileCard
  item={imageFile}
  type="image"  // Enables image preview
  imageProps={{
    preview: true,
    width: 200,
  }}
/>
```

### Pattern 4: Overflow Handling
```typescript
// Horizontal scroll with navigation
<Attachments
  items={items}
  onChange={handleChange}
  overflow="scrollX"  // Shows navigation arrows
/>

// Vertical scroll
<Attachments
  items={items}
  overflow="scrollY"
/>

// Wrap to multiple rows
<Attachments
  items={items}
  overflow="wrap"
/>
```

### Pattern 5: Semantic Styling
```typescript
<Attachments
  items={items}
  classNames={{
    list: 'my-custom-list',
    item: 'my-custom-item',
    placeholder: 'my-custom-placeholder',
    upload: 'my-custom-upload-btn',
  }}
  styles={{
    list: { gap: '20px' },
    item: { padding: '12px' },
    placeholder: { minHeight: '300px' },
    upload: { width: '100px' },
  }}
/>
```

### Pattern 6: Fullscreen Drop Area
```typescript
<Attachments
  items={items}
  onChange={handleChange}
  getDropContainer={() => document.body} // Fullscreen drop
  placeholder={(type) =>
    type === 'drop'
      ? { title: 'Drop Files Here (Fullscreen)' }
      : { title: 'Select Files' }
  }
/>
```

### Pattern 7: Server Upload Integration
```typescript
<Attachments
  items={items}
  onChange={handleChange}
  action="/api/upload" // Server endpoint
  method="POST"
  beforeUpload={(file) => {
    // Validate before sending
    return file.size < 10 * 1024 * 1024;
  }}
  onSuccess={(response, file) => {
    // Handle server response
    console.log('Upload successful:', response);
  }}
  onError={(error, file) => {
    // Handle upload error
    message.error('Upload failed');
  }}
/>
```

---

## Key Takeaways

1. **File State**: Always use `items` prop with controlled state via `onChange`
2. **Blob URLs**: Create with `URL.createObjectURL()`, clean up with `URL.revokeObjectURL()`
3. **Validation**: Use `beforeUpload` to validate files before upload
4. **Removal**: Implement `onRemove` to handle cleanup when files are deleted
5. **Drop Area**: Use `getDropContainer()` to define drag-drop regions
6. **Sender Integration**: Pass `senderRef.current?.nativeElement` to `getDropContainer` for Sender compatibility
7. **Placeholders**: Support different UI for 'inline' and 'drop' types
8. **Icons**: Preset icons auto-detect by extension or use custom icons
9. **Memory**: Always revoke blob URLs on component unmount to prevent memory leaks
10. **Ref Access**: Use `attachmentsRef.current?.upload(file)` to programmatically upload files

---

## File Structure Reference

```
Attachments Component
├── Main Component (index.tsx)
│   ├── Handles file state and onChange
│   ├── Manages ref for programmatic access
│   ├── Renders FileList or children + DropArea
│   └── Provides AttachmentContext
├── FileList (FileList/index.tsx)
│   ├── Renders individual FileListCard components
│   ├── Handles overflow (scrollX/scrollY/wrap)
│   ├── Shows upload button with SilentUploader
│   └── Manages scroll navigation buttons
├── FileListCard (FileList/FileListCard.tsx)
│   ├── Displays individual file with icon and info
│   ├── Supports image preview mode
│   ├── Shows upload progress
│   ├── Displays custom description or file size
│   └── Renders remove button
├── PlaceholderUploader (PlaceholderUploader.tsx)
│   ├── Hidden upload input
│   ├── Drag-drop visual feedback
│   └── Customizable placeholder UI
├── SilentUploader (SilentUploader.tsx)
│   └── Wraps children with upload functionality
├── DropArea (DropArea.tsx)
│   ├── Fullscreen/container drop zone
│   ├── Portaled to target container
│   └── Shows drop overlay on drag
└── Context (context.tsx)
    └── Provides disabled state to all children
```
