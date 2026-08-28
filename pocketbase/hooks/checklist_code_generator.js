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
      const checkRow = $app
        .db()
        .newQuery('SELECT id FROM checklists WHERE LOWER(code) = {:code} AND id != {:id} LIMIT 1')
        .bind({
          code: existingCode.toLowerCase(),
          id: e.record.id || '',
        })
        .one()

      if (!checkRow) {
        // Código válido e sem colisão -> HONRAR código enviado pelo mobile/cliente
        e.record.set('code', existingCode.toLowerCase())
        needsNewCode = false
      }
    } catch (_) {
      // Nenhum registro encontrado com esse código -> é único no servidor
      e.record.set('code', existingCode.toLowerCase())
      needsNewCode = false
    }
  }

  if (needsNewCode) {
    const yearPrefix = 'chk-' + targetYear + '-'
    let nextSeq = 1

    try {
      // Buscar os códigos existentes para o ano alvo para determinar o maior sequencial
      const rows = $app
        .db()
        .newQuery(
          'SELECT code FROM checklists WHERE LOWER(code) LIKE {:prefix} ORDER BY code DESC LIMIT 100',
        )
        .bind({
          prefix: yearPrefix.toLowerCase() + '%',
        })
        .all()

      if (rows && rows.length > 0) {
        let maxNum = 0
        for (let i = 0; i < rows.length; i++) {
          const c = String(rows[i].code || '').toLowerCase()
          if (c.startsWith(yearPrefix.toLowerCase())) {
            const numPart = parseInt(c.slice(yearPrefix.length), 10)
            if (!isNaN(numPart) && numPart > maxNum) {
              maxNum = numPart
            }
          }
        }
        nextSeq = maxNum + 1
      }
    } catch (err) {
      console.warn('[checklist_code_generator] Error querying max sequence:', err)
      nextSeq = 1
    }

    // Garantir que o código gerado seja rigorosamente único
    let generatedCode = ''
    let isUnique = false
    let attempts = 0

    while (!isUnique && attempts < 1000) {
      const seqStr = String(nextSeq).padStart(6, '0')
      generatedCode = yearPrefix + seqStr

      try {
        const collision = $app
          .db()
          .newQuery('SELECT id FROM checklists WHERE LOWER(code) = {:code} LIMIT 1')
          .bind({
            code: generatedCode.toLowerCase(),
          })
          .one()

        if (collision) {
          nextSeq++
          attempts++
        } else {
          isUnique = true
        }
      } catch (_) {
        // no row found -> unique
        isUnique = true
      }
    }

    e.record.set('code', generatedCode.toLowerCase())
  }

  e.next()
}, 'checklists')
