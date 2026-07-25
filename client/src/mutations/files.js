import { useMutation } from '@tanstack/react-query'

import { deleteFile, uploadFile } from '../services/files.js'

export function useUploadFile(orderItemId, options = {}) {
  return useMutation({
    mutationFn: (file) => uploadFile(orderItemId, file),
    ...options,
  })
}

export function useDeleteFile(options = {}) {
  return useMutation({
    mutationFn: (fileId) => deleteFile(fileId),
    ...options,
  })
}
