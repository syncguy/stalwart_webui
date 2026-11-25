// Static references, NOT proof of access in any user/license profile.
import { compare, ptr } from './locale-source.mjs';

// fieldOwners=false replays the historical pre-stage37 renderer contract only.
export function buildUsageGraph({ inventory, pins, resolver, pages, widgets, fieldOwners = false, formOwners = false, variantBadges = false, traceLabels = false, regionalLabels = false, specializedPaths = false, webuiRuBootstrapPaths = false }) {
  const byPointer = new Map();
  const usages = new Map(inventory.rows.map(r => [r.slot + '\0' + r.original, new Map()]));
  const screens = new Map();
  const unresolved = [];
  for (const row of inventory.rows) for (const loc of row.locations) {
    byPointer.set(loc.schemaHash + loc.sourcePointer, row);
  }
  function emit(pin, pointer, ctx, runtimeSlot, renderer = 'schemaText', state = ctx.state ?? 'wired') {
    const row = byPointer.get(pin.schemaHash + pointer);
    if (!row) return;
    const lookupSlot = runtimeSlot === undefined ? row.slot : runtimeSlot;
    const usage = { ...ctx, schemaHash: pin.schemaHash, edition: pin.edition, sourcePointer: pointer,
      lookupSlot, renderer, state: state === 'wired' && lookupSlot !== row.slot ? 'slot-mismatch' : state };
    usages.get(row.slot + '\0' + row.original).set(JSON.stringify(usage), usage);
  }
  function emitUnder(pin, pointer, ctx, renderer, state = 'wired') {
    for (const [key, row] of byPointer) {
      if (key.startsWith(pin.schemaHash + pointer + '/')) {
        emit(pin, key.slice(pin.schemaHash.length), ctx, row.slot, renderer, state);
      }
    }
  }
  const objectPage = (view, object, mode) => pages.find(p => p.modes?.includes(mode) && p.match.view === view)
    ?? pages.find(p => p.modes?.includes(mode) && p.match.object === object);
  const widgetFor = type => widgets.find(w =>
    (w.match.objectName && type.type === 'object' && w.match.objectName === type.objectName) ||
    (w.match.listObjectName && type.type === 'objectList' && w.match.listObjectName === type.objectName) ||
    (w.match.enumName && type.type === 'enum' && w.match.enumName === type.enumName))?.key;

  // Stage43 contracts: these five objects have a real compact summary in
  // ListCell -> FieldValue -> EmbeddedSummaryValue. Specialized editors have
  // no View override, so full detail uses the generic ObjectValue renderer.
  // Do not reinterpret other extension/widget families without review.
  const compactFamilies = new Set(['x:DnsManagement', 'x:CertificateManagement', 'x:TaskStatus', 'x:IndexStatus', 'x:KeySource']);
  const specialEditors = new Set(['x:Expression', 'x:Rate', 'x:OtpAuth', 'x:PasskeyRegistration']);
  const isResidualObject = name => compactFamilies.has(name) || specialEditors.has(name) || name === 'x:ExpressionMatch';
  for (const pin of pins) {
    const s = pin.data;
    const nav = [];
    // Exact custom trace consumers; historical graphs retain the original model.
    function traceUses(ctx, live) {
      const c = { ...ctx, state: 'wired', conditions: [...ctx.conditions, 'trace-event-or-filter-dependent'] };
      for (const [i] of (s.enums.EventType ?? []).entries()) {
        for (const property of ['label', 'explanation']) {
          emit(pin, ptr('enums', 'EventType', i, property), c, undefined, 'TraceTimeline/useTraceLabels');
          emit(pin, ptr('enums', 'EventType', i, property), c, undefined, 'TraceValue/useTraceLabels');
        }
        if (!live) emit(pin, ptr('enums', 'EventType', i, 'label'), c, undefined, 'TraceSummaryCards/useTraceLabels');
      }
      for (const [i] of (s.enums.Key ?? []).entries()) {
        emit(pin, ptr('enums', 'Key', i, 'label'), c, undefined, 'TraceValue/useTraceLabels');
        if (live) {
          emit(pin, ptr('enums', 'Key', i, 'label'), c, undefined, 'LiveTracingForm/useTraceLabels');
          emit(pin, ptr('enums', 'Key', i, 'label'), c, undefined, 'FilterEditor/useTraceLabels');
        }
      }
    }
    function walk(items, section, area, base) {
      items.forEach((entry, index) => {
        const wrapper = entry.link ? 'link' : entry.container ? 'container' : null;
        const item = wrapper ? entry[wrapper] : entry;
        const p = base + '/' + index + (wrapper ? '/' + wrapper : '');
        const ctx = { section, area, screen: '@navigation', mode: 'navigation', via: p,
          conditions: ['availability-unknown: runtime ACL, account and edition are not evaluated'] };
        emit(pin, p + '/name', ctx, undefined, 'schemaStore.walkLayouts');
        if (item.viewName) nav.push({ section, area, view: item.viewName, name: item.name, pointer: p });
        if (item.items) walk(item.items, section, area === section ? section + '/' + item.name : area, p + '/items');
      });
    }
    s.layouts.forEach((layout, i) => {
      emit(pin, ptr('layouts', i, 'name'), { section: layout.name, area: layout.name, screen: '@navigation', mode: 'navigation', via: '/layouts', conditions: ['availability-unknown'] }, undefined, 'schemaStore.walkLayouts');
      walk(layout.items, layout.name, layout.name, ptr('layouts', i, 'items'));
    });
    // Opt-in proposal: keep the complete stage18-43 replay unchanged by default.
    // BootstrapWizard is a separate application root, not a menu link.
    if (webuiRuBootstrapPaths && s.objects['x:Bootstrap']) nav.push({
      section: '@bootstrap', area: '@bootstrap', view: 'x:Bootstrap', name: 'Bootstrap',
      pointer: 'AdminPanel.isBootstrapMode', bootstrap: true,
    });

    for (const link of nav) {
      const object = resolver.resolveObject(s, link.view);
      const route = pages.find(p => !p.modes && (p.match.customComponent && link.view === 'CustomComponent/' + p.match.customComponent || p.match.viewPrefix && link.view.startsWith(p.match.viewPrefix)));
      const screenKey = link.section + '|' + link.view;
      const screen = screens.get(screenKey) ?? { section: link.section, area: link.area, view: link.view, name: link.name, editions: [], gates: [], modes: [] };
      screen.editions.push(pin.edition);
      screen.gates.push({ schemaHash: pin.schemaHash, permissionPrefix: object?.permissionPrefix ?? null,
        objectEnterpriseFlag: object?.enterprise ?? null, customGate: route?.gate ?? null, access: 'unknown' });
      screens.set(screenKey, screen);
      const base = { section: link.section, area: link.area, screen: link.view, via: link.pointer,
        conditions: ['availability-unknown: runtime ACL, account and edition are not evaluated',
          ...(link.bootstrap ? ['bootstrap-access-and-no-visible-layouts'] : []),
          ...(object ? ['permission-prefix:' + object.permissionPrefix, 'object-enterprise-flag:' + object.enterprise] : []),
          ...(route?.gate ? ['custom-gate:' + JSON.stringify(route.gate)] : [])] };
      if (route) {
        if (link.view === 'CustomComponent/Dashboard' || link.view.startsWith('Dashboard/')) {
          (s.dashboards ?? []).forEach((d, i) => {
            if (link.view.startsWith('Dashboard/') && link.view !== 'Dashboard/' + d.id) return;
            emitUnder(pin, ptr('dashboards', i), { ...base, mode: 'dashboard', via: d.id }, 'DashboardView/tiles');
          });
          screen.modes.push('dashboard');
        } else if (traceLabels && link.view === 'CustomComponent/LiveTracing') {
          screen.modes.push('live-tracing');
          traceUses({ ...base, mode: 'live-tracing' }, true);
        } else screen.modes.push('custom-review');
        continue;
      }
      if (!object) { unresolved.push({ ...link, edition: pin.edition, reason: 'No object or registered custom route' }); continue; }
      if (!link.bootstrap) emit(pin, ptr('objects', object.objectName, 'description'), { ...base, mode: 'search' }, undefined, 'schemaStore.searchIndex');
      const sch = resolver.resolveSchema(s, object.objectName);
      if (!sch) { unresolved.push({ ...link, edition: pin.edition, reason: 'No resolved schema' }); continue; }
      const list = resolver.resolveList(s, link.view, object.objectName);
      const listKey = s.lists[link.view] ? link.view : object.objectName;
      const selected = sch.type === 'single' ? [{ schemaName: sch.schemaName, fields: sch.fields }]
        : sch.variants.filter(v => !list?.filtersStatic?.['@type'] || list.filtersStatic['@type'] === v.name);
      const seen = new Set();

      function enumUses(type, ctx, role, fieldName) {
        // Custom timeline does not render the generic nested form's enum widgets.
        // Leave independent create/list/filter consumers intact; non-enum structural
        // candidates remain conservatively under review for stage43.
        if (traceLabels && ctx.state === 'review' && ['edit', 'detail'].includes(ctx.mode)
            && ['x:Trace/InboundDelivery', 'x:Trace/OutboundDelivery'].includes(link.view)
            && ['EventType', 'Key'].includes(type.enumName)) return;
        (s.enums[type.enumName] ?? []).forEach((v, i) => {
          const edit = ctx.mode === 'create' || ctx.mode === 'edit' || ctx.mode === 'singleton' || ctx.mode === 'action';
          let renderer = edit ? role === 'set' ? 'EnumMultiSelect' : role === 'map-key' ? 'MapKeyLabel' : 'EnumWidget' : 'EnumValue/ScalarLabel';
          if (ctx.mode === 'filter') renderer = 'EnumFilter';
          if (edit && role === 'map-key' && fieldName === 'quotas') renderer += ':quota';
          if (!regionalLabels && edit && role === 'scalar' && fieldName === 'locale') renderer += ':Intl.Locale';
          if (edit && role === 'scalar' && fieldName === 'headerProtection') renderer += ':headerProtection';
          if (type.enumName === 'TimeZone' && role === 'scalar') {
            renderer = regionalLabels ? (edit ? 'TimeZoneWidget' : 'TimeZoneValue') : 'TimeZoneWidget/Value:Intl';
          }
          const ec = { ...ctx, via: ctx.via + ':' + role + ':' + fieldName,
            conditions: [...ctx.conditions, ...(type.enumName === 'Permission' && edit ? ['enum-permission-filter:hasPermission(raw-ID)'] : [])] };
          emit(pin, ptr('enums', type.enumName, i, 'label'), ec, undefined, renderer);
          if (edit && ['scalar', 'set'].includes(role) && type.enumName !== 'TimeZone') {
            emit(pin, ptr('enums', type.enumName, i, 'explanation'), ec, undefined, renderer);
          }
        });
      }
      function typeUses(type, ctx, fieldName, role = 'scalar') {
        if (!type) return;
        if (type.type === 'enum') return enumUses(type, ctx, role, fieldName);
        if (type.type === 'set') return typeUses(type.class, ctx, fieldName, 'set');
        if (type.type === 'map') {
          typeUses(type.keyClass, ctx, fieldName, 'map-key');
          typeUses(type.valueClass, ctx, fieldName, 'map-value');
        }
        if (type.type !== 'object' && type.type !== 'objectList') return;
        // In compact mode the map renders keys only, and an objectList renders
        // a client-localized count. Never infer nested form captions from them.
        if (specializedPaths && ctx.mode === 'list-cell' && isResidualObject(type.objectName)
            && (role === 'map-value' || type.type === 'objectList')) return;
        const nested = resolver.resolveSchema(s, type.objectName);
        if (!nested) { unresolved.push({ screen: link.view, object: type.objectName, reason: 'Unresolved nested schema' }); return; }
        const variants = nested.type === 'single' ? [{ schemaName: nested.schemaName, fields: nested.fields }] : nested.variants;
        const custom = widgetFor(type);
        if (specializedPaths && isResidualObject(type.objectName)) {
          // Expression/Rate/OTP/Passkey Edit renders client text, not the
          // schema's inner fields. Keep full generic detail separate.
          if (specialEditors.has(type.objectName) && ctx.mode !== 'detail' && ctx.mode !== 'list-cell') return;
          if (ctx.mode === 'list-cell') {
            // No special View override on these objects. The actual helper
            // selects a variant label and at most one eligible scalar;
            // set/map/list/secret/multiline fields never become captions.
            const sc = { ...ctx, conditions: [...ctx.conditions, 'nested-value-dependent', 'compact-summary:variant-and-selected-scalar'] };
            variantUses(type.objectName, sc, nested.type === 'multiple' ? nested.variants : []);
            for (const v of variants) {
              // A present enum scalar can be selected by embeddedSummary's
              // form-order candidates or its short-string fallback. All
              // other eligible scalar types contribute data, not schema text.
              for (const [name, field] of Object.entries(v.fields?.properties ?? {})) {
                if (field.type?.type !== 'enum' || name === '@type' || name === 'id') continue;
                enumUses(field.type, { ...sc, via: v.schemaName + '/' + name,
                  conditions: [...sc.conditions, 'summary-selected-enum-dependent'] }, 'scalar', name);
              }
            }
            return;
          }
        }
        const customUnknown = custom && !custom.startsWith('enum:')
          && !(specializedPaths && specialEditors.has(type.objectName) && ctx.mode === 'detail');
        // Compact cells render summaries, not the full nested form. Do not inflate coverage.
        const review = customUnknown || ctx.mode === 'list-cell' || ctx.state === 'review';
        const nc = { ...ctx, state: review ? 'review' : ctx.state,
          conditions: [...ctx.conditions, 'nested-value-dependent', ...(customUnknown ? ['special-widget:' + custom] : [])] };
        variantUses(type.objectName, nc, nested.type === 'multiple' ? nested.variants : []);
        for (const v of variants) {
          const key = [type.objectName, v.schemaName, ctx.mode, nc.state].join('|');
          if (seen.has(key)) continue;
          seen.add(key); // finite graph, shared nodes deduplicated per screen/mode
          const formKey = s.forms[v.schemaName] ? v.schemaName : nested.type === 'single' && s.forms[type.objectName] ? type.objectName : null;
          if (formKey) formUses(formKey, v.schemaName, v.fields, { ...nc, via: type.objectName }, true, 0, v.schemaName);
          else for (const [name, field] of Object.entries(v.fields?.properties ?? {})) {
            emit(pin, ptr('fields', v.schemaName, 'properties', name, 'description'), nc, undefined, 'fallback-field-context', 'review');
            typeUses(field.type, { ...nc, via: v.schemaName + '/' + name }, name);
          }
        }
      }
      function variantUses(name, ctx, variants) {
        const raw = s.schemas[name];
        for (const v of variants) {
          const i = raw.variants.findIndex(x => x.name === v.name);
          // Stage39: DynamicView top-level badge now uses the exact raw object/type
          // identity. Keep the old raw path available for historical replay.
          const topDetail = ctx.mode === 'detail' && name === object.objectName;
          const rawBadge = topDetail && !variantBadges;
          emit(pin, ptr('schemas', name, 'variants', i, 'label'), ctx,
            rawBadge ? null : undefined,
            topDetail && variantBadges ? 'DynamicView' : specializedPaths && ctx.mode === 'list-cell' && compactFamilies.has(name) ? 'EmbeddedSummaryValue' : 'VariantSelect/ObjectValue',
            ctx.state === 'review' ? 'review' : rawBadge ? 'unwired' : 'wired');
        }
      }
      function formUses(formKey, fieldsKey, fields, ctx, embedded, offset, lookupKey) {
        const form = s.forms[formKey];
        if (!form) return;
        const readonly = ctx.mode === 'detail' || ctx.mode === 'list-cell';
        const state = ctx.state === 'review' ? 'review' : 'wired';
        if (!embedded && !readonly) {
          emit(pin, ptr('forms', formKey, 'subtitle'), ctx, 'form/' + formKey + '/subtitle', 'DynamicForm', state);
          if (object.objectType.type === 'singleton') emit(pin, ptr('forms', formKey, 'title'), ctx, 'form/' + (formOwners ? formKey : object.objectName) + '/title', 'DynamicForm', state);
        }
        form.sections.forEach((section, i) => {
          const eligible = section.fields.filter(ff => {
            const field = fields?.properties[ff.name];
            return (ff.name === '@type' || field) && (!link.bootstrap || !field?.enterprise && field?.update !== 'serverSet');
          });
          if (!eligible.length) return;
          if (!embedded) emit(pin, ptr('forms', formKey, 'sections', i, 'title'), ctx,
            'form/' + (formOwners && readonly ? formKey : lookupKey) + '/section/section-' + (readonly && !formOwners ? i + offset : i), 'FormSections/DynamicView', state);
          for (const [j, ff] of section.fields.entries()) {
            const field = fields?.properties[ff.name];
            if (ff.name !== '@type' && !field) continue;
            if (link.bootstrap && field?.enterprise) continue;
            // VacationResponsePage hides toDate and replaces fromDate with
            // PeriodRow (client t() caption/help, raw dates still submitted).
            if (specializedPaths && formKey === 'VacationResponse' && ctx.mode === 'singleton'
                && ['fromDate', 'toDate'].includes(ff.name)) continue;
            if (ctx.mode === 'create' && field?.update === 'serverSet' || embedded && !readonly && field?.update === 'serverSet') continue;
            if (readonly && ff.name === '@type') continue;
            const fc = { ...ctx, via: formKey + '/' + ff.name,
              conditions: [...ctx.conditions, ...(field?.enterprise ? ['field-enterprise-flag:true'] : []),
                ...(field ? ['field-update:' + field.update] : []), ...(readonly ? ['nonempty-value-required'] : [])] };
            const props = readonly ? ['label'] : ['label', 'placeholder', 'keyLabel', 'valueLabel'];
            for (const p of props) emit(pin, ptr('forms', formKey, 'sections', i, 'fields', j, p), fc,
              'form/' + (formOwners && readonly ? formKey : lookupKey) + '/field/' + ff.name + (p === 'label' ? '' : '/' + p), 'FieldRow/DynamicView', state);
            if (field) {
              emit(pin, ptr('fields', fieldsKey, 'properties', ff.name, 'description'), fc,
                'field/' + (fieldOwners ? fieldsKey : lookupKey) + '/' + ff.name + '/description', 'FieldRow/DynamicView', state);
              typeUses(field.type, fc, ff.name);
            }
          }
        });
      }

      if (list && object.objectType.type !== 'singleton') {
        const special = objectPage(link.view, object.objectName, 'list');
        const ctx = { ...base, mode: 'list' };
        screen.modes.push('list');
        if (object.objectName === 'x:Action') {
          for (const p of ['title', 'subtitle']) emit(pin, ptr('lists', listKey, p), ctx, undefined, 'ActionPage');
        } else emitUnder(pin, ptr('lists', listKey), ctx, 'DynamicList', special ? 'review' : 'wired');
        for (const filter of list.filters ?? []) if (filter.type === 'enum') typeUses(filter, { ...base, mode: 'filter', via: listKey + '/' + filter.field }, filter.field);
        for (const v of selected) for (const column of list.columns ?? []) {
          if (column.name === '@type') variantUses(object.objectName, { ...base, mode: 'list-cell' }, sch.type === 'multiple' ? sch.variants : []);
          const field = v.fields?.properties[column.name];
          if (field) typeUses(field.type, { ...base, mode: 'list-cell', via: listKey + '/' + column.name }, column.name);
        }
      }
      if (link.bootstrap) {
        const success = { ...base, mode: 'bootstrap-success', conditions: [...base.conditions,
          'bootstrap-access-and-no-visible-layouts', 'returned-nonempty-string-extra'] };
        for (const name of ['username', 'secret']) emit(pin,
          ptr('fields', 'x:Bootstrap', 'properties', name, 'description'), success, undefined, 'SuccessScreen');
      }
      const modes = link.bootstrap ? ['create'] : object.objectName === 'x:Action' ? ['action'] : object.objectType.type === 'singleton' ? ['singleton'] : ['create', 'edit', 'detail'];
      for (const mode of modes) {
        screen.modes.push(mode);
        const special = objectPage(link.view, object.objectName, mode);
        const vacation = specializedPaths && special && object.objectName === 'VacationResponse' && mode === 'singleton';
        const ctx = { ...base, mode, ...(special && mode !== 'action' && !vacation ? { state: 'review' } : {}),
          conditions: [...base.conditions, 'mode-permission-and-data-dependent', ...(vacation
            ? ['custom-page:VacationResponsePage/DynamicForm']
            : special ? ['custom-page:explicit-adapter-review-required'] : [])] };
        if (traceLabels && special && ['edit', 'detail'].includes(mode)
            && ['x:Trace/InboundDelivery', 'x:Trace/OutboundDelivery'].includes(link.view)) {
          traceUses({ ...base, mode, conditions: [...base.conditions, 'mode-permission-and-data-dependent', 'custom-page:TraceDetailView'] }, false);
          // This page is not a generic form/view. Preserve the independent
          // list/filter/create graph, but do not invent structural captions
          // in TraceTimeline/TraceSummaryCards.
          if (specializedPaths) continue;
        }
        const variants = sch.type === 'multiple' ? selected : [];
        variantUses(object.objectName, ctx, variants);
        for (const v of selected) {
          const vc = { ...ctx, conditions: [...ctx.conditions, ...(v.name ? ['variant:' + v.name] : [])] };
          if (sch.type === 'single') {
            const form = resolver.resolveForm(s, link.view, object.objectName, v.schemaName);
            const formKey = Object.keys(s.forms).find(k => s.forms[k] === form);
            if (formKey) formUses(formKey, v.schemaName, v.fields, vc, false, 0, mode === 'detail' ? link.view : formKey);
          } else {
            const parentKey = s.forms[link.view] ? link.view : object.objectName;
            const parent = s.forms[parentKey];
            if (parent && mode !== 'action') formUses(parentKey, v.schemaName, v.fields, vc, false, 0, mode === 'detail' ? link.view : object.objectName);
            if (v.schemaName) formUses(v.schemaName, v.schemaName, v.fields, vc, false, parent?.sections.length ?? 0, mode === 'detail' ? link.view : v.schemaName);
          }
        }
      }
    }
  }
  return {
    usages: new Map([...usages].map(([k, m]) => [k, [...m.values()].sort((a, b) => compare(JSON.stringify(a), JSON.stringify(b)))])),
    screens: [...screens.values()].map(s => ({ ...s, editions: [...new Set(s.editions)].sort(compare), modes: [...new Set(s.modes)].sort(compare) }))
      .sort((a, b) => compare(a.section + a.view, b.section + b.view)),
    unresolved,
  };
}
