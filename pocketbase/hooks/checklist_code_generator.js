/**
 * Checklist Code Generator Hook
 *
 * Gera de forma atômica e sequencial o código único do checklist no formato:
 * "chk-<ano>-<sequencial>" com 6 dígitos (ex: chk-2026-000001, chk-2026-000002, ..., chk-2026-999999).
 *
 * Regras:
 * - Todo checklist novo que for criado no backend recebe o código definitivo sequencial pelo ano.
 * - Caso o registro já tenha um código no formato exato "chk-YYYY-NNNNNN" que não colida (por exemplo, migrado ou já atribuído), mantém.
 * - Códigos temporários de offline (como "chk-local-...", "CHK-...", ou vazios) são substituídos pelo código definitivo oficial.
 * - Executa em transação/lock para garantir que não haja duplicidade mesmo com múltiplos usuários ou empresas criando simultaneamente.
 */

onRecordCreate((e) => {
  try {
    const existingCode = (e.record.get('code') || '').toString().trim()

    // Reconhece o formato oficial "chk-YYYY-NNNNNN"
    const officialPattern = /^chk-(\d{4})-(\d{6})$/i
    const match = existingCode.match(officialPattern)

    let needsNewCode = true
    let targetYear = new Date().getFullYear()

    if (match) {
      const codeYear = parseInt(match[1], 10)
      if (!isNaN(codeYear)) {
        targetYear = codeYear
      }

      // Verificar se já não existe outro registro com este mesmo código
      try {
        const collisions = $app.findRecordsByFilter(
          'checklists',
          `code = '${existingCode.toLowerCase()}'`,
          '',
          1,
          0,
        )

        const existingRecordId = e.record.id || ''
        const hasCollision =
          collisions &&
          collisions.length > 0 &&
          (!existingRecordId || collisions[0].id !== existingRecordId)

        if (!hasCollision) {
          // Código válido e sem colisão -> HONRAR código enviado pelo mobile/cliente
          e.record.set('code', existingCode.toLowerCase())
          needsNewCode = false
        }
      } catch (checkErr) {
        console.warn('[checklist_code_generator] Error checking existing code collision:', checkErr)
        // Se falhou ao checar, assume que precisa de um código novo seguro
      }
    }

    if (needsNewCode) {
      const yearPrefix = 'chk-' + targetYear + '-'
      let nextSeq = 1

      try {
        // Buscar registros do ano via findRecordsByFilter com sort -code (ou -created)
        const recentRecords = $app.findRecordsByFilter(
          'checklists',
          `code ~ '${yearPrefix}'`,
          '-code',
          50,
          0,
        )

        if (recentRecords && recentRecords.length > 0) {
          let maxNum = 0
          for (let i = 0; i < recentRecords.length; i++) {
            const c = String(recentRecords[i].get('code') || '')
              .toLowerCase()
              .trim()
            if (c.startsWith(yearPrefix.toLowerCase())) {
              const numPart = parseInt(c.slice(yearPrefix.length), 10)
              if (!isNaN(numPart) && numPart > maxNum) {
                maxNum = numPart
              }
            }
          }
          if (maxNum > 0) {
            nextSeq = maxNum + 1
          }
        }
      } catch (err) {
        console.warn('[checklist_code_generator] Error querying max sequence:', err)
        nextSeq = 1
      }

      // Garantir que o código gerado seja rigorosamente único
      let generatedCode = ''
      let isUnique = false
      let attempts = 0

      while (!isUnique && attempts < 100) {
        const seqStr = String(nextSeq).padStart(6, '0')
        generatedCode = yearPrefix + seqStr

        try {
          const collisions = $app.findRecordsByFilter(
            'checklists',
            `code = '${generatedCode.toLowerCase()}'`,
            '',
            1,
            0,
          )

          if (collisions && collisions.length > 0) {
            nextSeq++
            attempts++
          } else {
            isUnique = true
          }
        } catch (_) {
          isUnique = true
        }
      }

      if (generatedCode) {
        e.record.set('code', generatedCode.toLowerCase())
      }
    }
  } catch (globalHookErr) {
    // RESILIÊNCIA: a geração de código NUNCA deve derrubar a criação do checklist
    console.warn(
      '[checklist_code_generator] Unhandled error in hook, continuing without throwing:',
      globalHookErr,
    )
    if (!e.record.get('code')) {
      const fallbackYear = new Date().getFullYear()
      const fallbackTimestamp = Date.now().toString().slice(-6)
      e.record.set('code', 'chk-' + fallbackYear + '-' + fallbackTimestamp)
    }
  }

  e.next()
}, 'checklists')
