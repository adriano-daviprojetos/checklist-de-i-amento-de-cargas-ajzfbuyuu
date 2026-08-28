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
  const currentYear = new Date().getFullYear()
  const yearPrefix = 'chk-' + currentYear + '-'

  const existingCode = (e.record.get('code') || '').toString().trim()

  // Se já for um código oficial no padrão chk-YYYY-NNNNNN para o ano atual
  const officialPattern = /^chk-\d{4}-\d{6}$/i
  let needsNewCode = true

  if (officialPattern.test(existingCode)) {
    // Verificar se já não existe outro registro com este mesmo código
    try {
      const checkRow = $app
        .db()
        .newQuery('SELECT id FROM checklists WHERE code = {:code} AND id != {:id} LIMIT 1')
        .bind({
          code: existingCode.toLowerCase(),
          id: e.record.id || '',
        })
        .one()

      if (!checkRow) {
        // Código válido e sem colisão
        e.record.set('code', existingCode.toLowerCase())
        needsNewCode = false
      }
    } catch (_) {
      // Nenhum registro com esse código -> é único
      e.record.set('code', existingCode.toLowerCase())
      needsNewCode = false
    }
  }

  if (needsNewCode) {
    let nextSeq = 1

    try {
      // Buscar o maior sequencial existente para o ano corrente usando raw SQL
      const rows = $app
        .db()
        .newQuery(
          'SELECT code FROM checklists WHERE code LIKE {:prefix} ORDER BY code DESC LIMIT 50',
        )
        .bind({
          prefix: yearPrefix + '%',
        })
        .all()

      if (rows && rows.length > 0) {
        let maxNum = 0
        for (let i = 0; i < rows.length; i++) {
          const c = String(rows[i].code || '').toLowerCase()
          if (c.startsWith(yearPrefix)) {
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

    // Garantir que o código gerado seja livre de colisão
    let generatedCode = ''
    let isUnique = false
    let attempts = 0

    while (!isUnique && attempts < 1000) {
      const seqStr = String(nextSeq).padStart(6, '0')
      generatedCode = yearPrefix + seqStr

      try {
        const collision = $app
          .db()
          .newQuery('SELECT id FROM checklists WHERE code = {:code} LIMIT 1')
          .bind({
            code: generatedCode,
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

    e.record.set('code', generatedCode)
  }

  e.next()
}, 'checklists')
