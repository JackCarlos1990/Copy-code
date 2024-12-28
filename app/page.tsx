'use client'

import { useState, useEffect, useRef } from 'react'
import { Textarea } from "@/components/ui/textarea"
import { Folder, FileIcon, Plus, Edit, Trash2, X, ChevronRight, Copy } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { toast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

interface Item {
  id: string;
  name: string;
  isFile: boolean;
  parentId: string | null;
  path: string;
  content?: string;
  isOpen?: boolean;
}

interface PopupState {
  type: 'add' | 'edit';
  item?: Item;
}

export default function Home() {
  const [text, setText] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [newItemName, setNewItemName] = useState('')
  const [popup, setPopup] = useState<PopupState | null>(null)
  const [editContent, setEditContent] = useState('')
  const [showCopyDialog, setShowCopyDialog] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const savedText = localStorage.getItem('backupText')
    if (savedText) {
      setText(savedText)
    }
    const savedItems = localStorage.getItem('items')
    if (savedItems) {
      setItems(JSON.parse(savedItems))
    } else {
      setItems([
        {
          id: 'root',
          name: 'app',
          isFile: false,
          parentId: null,
          path: 'app',
          isOpen: true
        }
      ])
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setPopup(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value
    setText(newText)
    localStorage.setItem('backupText', newText)
  }

  const hasFileExtension = (name: string) => {
    return name.includes('.')
  }

  const findDeepestExistingFolder = (path: string): Item | null => {
    const parts = path.split('/')
    let currentPath = ''
    let deepestFolder: Item | null = null

    for (const part of parts) {
      currentPath += (currentPath ? '/' : '') + part
      const folder = items.find(item => item.path === currentPath && !item.isFile)
      if (folder) {
        deepestFolder = folder
      } else {
        break
      }
    }

    return deepestFolder
  }

  const createPathItems = (inputPath: string) => {
    const newItems: Item[] = []
    let parts = inputPath.split('/')
    
    if (parts[0] !== 'app') {
      parts = ['app', ...parts]
    }

    let currentPath = ''
    let parentId: string | null = null

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      currentPath += (currentPath ? '/' : '') + part
      const isFile = i === parts.length - 1 && hasFileExtension(part)

      const existingItem = items.find(item => item.path === currentPath)

      if (!existingItem) {
        if (i === 0 && part !== 'app') {
          parentId = 'root'
        }

        const newItem: Item = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: part,
          isFile,
          parentId,
          path: currentPath,
          content: isFile ? '' : undefined,
          isOpen: true
        }
        newItems.push(newItem)
        parentId = newItem.id
      } else {
        parentId = existingItem.id
      }
    }

    return newItems
  }

  const handleAddItem = () => {
    if (newItemName.trim()) {
      const deepestFolder = findDeepestExistingFolder(newItemName.trim())
      const pathToCreate = deepestFolder 
        ? newItemName.trim().slice(deepestFolder.path.length + 1) 
        : newItemName.trim()

      const newItems = createPathItems(pathToCreate)
      if (newItems.length > 0) {
        if (deepestFolder) {
          newItems[0].parentId = deepestFolder.id
          newItems[0].path = `${deepestFolder.path}/${newItems[0].name}`
        }

        const updatedItems = [...items, ...newItems]
        setItems(updatedItems)
        localStorage.setItem('items', JSON.stringify(updatedItems))
        setNewItemName('')
        setPopup(null)
      }
    }
  }

  const handlePlusClick = () => {
    setPopup({
      type: 'add'
    })
  }

  const handleEditClick = (item: Item) => {
    setPopup({
      type: 'edit',
      item
    })
    setEditContent(item.content || '')
  }

  const handleSaveContent = () => {
    if (popup?.item) {
      const updatedItems = items.map(item => 
        item.id === popup.item?.id ? { ...item, content: editContent } : item
      )
      setItems(updatedItems)
      localStorage.setItem('items', JSON.stringify(updatedItems))
      setPopup(null)
    }
  }

  const handleCopyContent = () => {
    if (popup?.item) {
      navigator.clipboard.writeText(editContent).then(() => {
        toast({
          title: "已複製",
          description: "內容已成功複製到剪貼板",
        })
      }).catch(err => {
        console.error('無法複製文本: ', err)
        toast({
          title: "複製失敗",
          description: "無法複製內容到剪貼板",
          variant: "destructive",
        })
      })
    }
  }

  const handleDeleteItem = (itemToDelete: Item) => {
    const deleteRecursively = (id: string) => {
      const itemsToDelete = new Set<string>([id])
      
      const findChildren = (parentId: string) => {
        items.forEach(item => {
          if (item.parentId === parentId) {
            itemsToDelete.add(item.id)
            findChildren(item.id)
          }
        })
      }
      
      findChildren(id)
      return items.filter(item => !itemsToDelete.has(item.id))
    }

    const updatedItems = deleteRecursively(itemToDelete.id)
    setItems(updatedItems)
    localStorage.setItem('items', JSON.stringify(updatedItems))
  }

  const toggleFolder = (folderId: string) => {
    setItems(prevItems => 
      prevItems.map(item => 
        item.id === folderId ? { ...item, isOpen: !item.isOpen } : item
      )
    )
  }

  const renderItems = (parentId: string | null, level: number = 0) => {
    const currentLevelItems = items
      .filter(item => item.parentId === parentId)
      .sort((a, b) => {
        if (!a.isFile && b.isFile) return -1;
        if (a.isFile && !b.isFile) return 1;
        return a.name.localeCompare(b.name);
      });

    return currentLevelItems.length > 0 ? (
      <div className="space-y-1">
        {currentLevelItems.map((item) => (
          <div key={item.id} className="flex flex-col">
            {item.isFile ? (
              <div 
                className="flex items-center space-x-2 rounded p-1 mb-1 w-fit"
                style={{ marginLeft: `${level * 20}px` }}
              >
                <FileIcon className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-600">{item.name}</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleEditClick(item)}
                  className="p-1 h-auto"
                >
                  <Edit className="h-4 w-4 text-gray-400" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleDeleteItem(item)}
                  className="p-1 h-auto"
                >
                  <Trash2 className="h-4 w-4 text-gray-400" />
                </Button>
              </div>
            ) : (
              <Collapsible open={item.isOpen}>
                <CollapsibleTrigger asChild>
                  <div 
                    className="flex items-center space-x-2 rounded p-1 mb-1 w-fit cursor-pointer"
                    style={{ marginLeft: `${level * 20}px` }}
                    onClick={() => toggleFolder(item.id)}
                  >
                    <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${item.isOpen ? 'transform rotate-90' : ''}`} />
                    <Folder className="h-5 w-5 text-gray-400" />
                    <span className="text-sm text-gray-600">{item.name}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteItem(item);
                      }}
                      className="p-1 h-auto"
                    >
                      <Trash2 className="h-4 w-4 text-gray-400" />
                    </Button>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {renderItems(item.id, level + 1)}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        ))}
      </div>
    ) : null;
  };

  const generateStructuredText = (parentId: string | null = null, level: number = 0): string => {
    const indent = '  '.repeat(level);
    let result = '';

    const currentLevelItems = items
      .filter(item => item.parentId === parentId)
      .sort((a, b) => {
        if (!a.isFile && b.isFile) return -1;
        if (a.isFile && !b.isFile) return 1;
        return a.name.localeCompare(b.name);
      });

    for (const item of currentLevelItems) {
      result += `${indent}${item.name}\n`;
      
      if (item.content) {
        result += `${indent}  ${item.content}\n`;
      }
      
      if (!item.isFile) {
        result += generateStructuredText(item.id, level + 1);
      }
    }

    return result;
  };

  const handleGlobalCopy = () => {
    const structuredText = generateStructuredText();
    navigator.clipboard.writeText(structuredText).then(() => {
      setShowCopyDialog(true);
      setTimeout(() => setShowCopyDialog(false), 1500); // 1.5秒後自動關閉
    }).catch(err => {
      console.error('無法複製文本: ', err);
      toast({
        title: "複製失敗",
        description: "無法複製內容到剪貼板",
        variant: "destructive",
      });
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-6 sm:p-24 bg-sky-100">
      <h1 className="text-xl font-bold text-green-800 mb-2">克隆代碼庫</h1>
      <div className="w-full max-w-4xl h-[calc(100vh-100px)] relative rounded bg-white">
        <Button 
          onClick={handleGlobalCopy}
          className="absolute top-2 right-2 px-3 py-1.5 text-sm bg-[#0a0a23] hover:bg-[#0a0a23]/90 text-white active:translate-y-0.5 transition-transform"
        >
          全局克隆
        </Button>
        <div className="absolute top-0 left-2 flex flex-col items-start space-y-2 mb-4">
          <span className="text-sm text-gray-400">根目錄</span>
          <Button 
            variant="outline" 
            size="sm" 
            className="p-1 h-auto border-gray-200"
            onClick={handlePlusClick}
          >
            <Plus className="h-5 w-5 text-yellow-600" />
          </Button>
        </div>
        
        {popup && (
          <>
            <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setPopup(null)} />
            <div 
              ref={popupRef}
              className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-4 w-80 z-50 border border-gray-200"
            >
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-medium">
                  {popup.type === 'add' ? '新增檔案' : `輸入代碼`}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPopup(null)}
                  className="p-1 h-auto"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {popup.type === 'add' ? (
                <>
                  <Input
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="輸入路徑 (例: hjk/top)"
                    className="text-sm mb-2 border border-gray-200"
                  />
                  <Button 
                    onClick={handleAddItem} 
                    className="w-full bg-[#0a0a23] hover:bg-[#0a0a23]/90"
                  >
                    確認
                  </Button>
                </>
              ) : (
                <>
                  <Textarea
                    ref={textareaRef}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-[200px] mb-2 text-sm border border-gray-200"
                    onClick={() => textareaRef.current?.focus()}
                  />
                  <div className="flex justify-center space-x-4 mt-4">
                    <Button 
                      onClick={handleSaveContent}
                      className={cn(
                        "flex-1 bg-[#0a0a23] hover:bg-[#0a0a23]/90 active:translate-y-0.5 transition-transform",
                        "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0a0a23]"
                      )}
                    >
                      保存
                    </Button>
                    <Button 
                      onClick={handleCopyContent}
                      className={cn(
                        "flex-1 bg-[#0a0a23] hover:bg-[#0a0a23]/90 active:translate-y-0.5 transition-transform",
                        "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0a0a23]"
                      )}
                    >
                      <Copy className="mr-2 h-4 w-4" /> 複製
                    </Button>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        <div className="absolute top-14 left-2 space-y-2 overflow-auto max-h-[calc(100vh-260px)] p-4 rounded-lg">
          {renderItems(null)}
        </div>
        <Textarea
          value={text}
          onChange={handleTextChange}
          className="w-full h-full resize-none pt-20 pl-32"
        />
        {showCopyDialog && (
          <div
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-500 text-white px-6 py-3 rounded-md shadow-lg transition-opacity duration-300"
          >
            <span className="text-sm font-medium">克隆成功</span>
          </div>
        )}
      </div>
    </main>
  )
}