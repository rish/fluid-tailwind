import { Container } from 'postcss'
import { Length, RawValue } from './css'
import { error } from './errors'
import { clamp, precision, toPrecision } from './math'
import { Context } from './context'

// Convert a RawValue to a length, which also resolves theme() values
const length = (val: RawValue | Length, { theme }: Context) => {
	if (val instanceof Length) return val
	if (typeof val === 'string') {
		// Test if it's a theme() function
		const [, lookup] = val.match(/^\s*theme\((.*?)\)\s*$/) ?? []
		if (lookup) val = theme(lookup)
	}
	return Length.parse(val)
}

const resolveBP = (
	bp: RawValue | Length,
	type: 'start' | 'end',
	context: Context,
	atContainer?: string | true
) => {
	if (!bp) {
		bp =
			context[`default${type === 'start' ? 'Start' : 'End'}${atContainer ? 'Container' : 'Screen'}`]
		if (!bp) error(`missing-default-${type}-bp`)
	}
	if (bp instanceof Length) return bp
	const len = length(bp, context)
	if (!len) error(`non-length-${type}-bp`, bp as string)
	return len
}

export const generate = (
	_start: RawValue | Length,
	_end: RawValue | Length,
	context: Context,
	{
		startBP: _startBP,
		endBP: _endBP,
		atContainer,
		checkSC144 = false,
		checkBP = false
	}: {
		startBP?: RawValue | Length
		endBP?: RawValue | Length
		atContainer?: string | true
		checkSC144?: boolean
		checkBP?: boolean
	} = {}
) => {
	if (!_start) error('missing-start')
	const start = length(_start, context)
	if (!start) error('non-length-start', _start as string)

	if (!_end) error('missing-end')
	const end = length(_end, context)
	if (!end) error('non-length-end', _end as string)

	const startBP = resolveBP(_startBP, 'start', context, atContainer)
	const endBP = resolveBP(_endBP, 'end', context, atContainer)

	if (!start.unit || start.unit !== end.unit) error('mismatched-units', start, end)
	const unit = start.unit

	if (start.number === end.number) error('no-change', start)

	let comment = `/* fluid from ${start.cssText} at ${startBP.cssText} to ${end.cssText} at ${endBP.cssText}${atContainer ? ' (container)' : ''} */`

	// Return comment if the startBP.unit != endBP.unit. We can't throw because they could change the breakpoints later with a variant
	if (!startBP.unit || startBP.unit !== endBP.unit) {
		if (checkBP) error('mismatched-bp-units', startBP, endBP)
		return comment
	}

	// Return comment if the startBP = endBP. We can't throw because they could change the breakpoints later with a variant
	if (startBP.number === endBP.number) {
		if (checkBP) error('no-change-bp', startBP)
		return comment
	}

	// Return comment if the start.unit != startBP.unit. We can't throw because they could change the breakpoints later with a variant
	if (start.unit !== startBP.unit) {
		if (checkBP) error('mismatched-bp-val-units')
		return comment
	}

	const p = Math.max(
		precision(start.number),
		precision(startBP.number),
		precision(end.number),
		precision(endBP.number),
		2
	)

	const min = `${Math.min(start.number, end.number)}${unit}` // CSS requires the min < max in a clamp
	const max = `${Math.max(start.number, end.number)}${unit}` // CSS requires the min < max in a clamp
	const slope = (end.number - start.number) / (endBP.number - startBP.number)
	const intercept = start.number - startBP.number * slope

	// SC 1.4.4 check
	let failingBP: Length | null = null
	if (checkSC144) {
		const zoom1 = (vw: number) => clamp(start.number, intercept + slope * vw, end.number) // 2*zoom1(vw) is the AA requirement
		const zoom5 = (vw: number) =>
			clamp(5 * start.number, 5 * intercept + slope * vw, 5 * end.number) // browser doesn't scale vw units when zooming, so this isn't 5*zoom1(vw)

		// Check the clamped points on the lines 2*z1(vw) and zoom5(vw) and fail if zoom5 < 2*zoom1
		if (5 * start.number < 2 * zoom1(5 * startBP.number))
			failingBP = new Length(startBP.number * 5, startBP.unit) // fails at 5*startBP
		else if (zoom5(endBP.number) < 2 * end.number) failingBP = endBP
	}

	comment = `/* ${failingBP ? 'not ' : ''}fluid from ${start.cssText} at ${startBP.cssText} to ${end.cssText} at ${endBP.cssText}${atContainer ? ' (container)' : ''}${checkSC144 ? '; ' + (failingBP ? 'fails WCAG SC 1.4.4 at i.e. ' + failingBP.cssText : 'passes WCAG SC 1.4.4') : ''} */`

	// Return the start value if it fails SC 1.4.4, so that it could be potentially corrected with a fluid variant
	if (failingBP) return comment

	return `clamp(${min},${toPrecision(intercept, p)}${unit} + ${toPrecision(slope * 100, p)}${atContainer ? 'cqw' : 'vw'},${max})${comment}`
}

export const parse = (expr: string) => {
	const [match, rawStart, rawStartBP, rawEnd, rawEndBP, container, containerName] =
		expr.match(
			/\/\* (?:not )?fluid from (.*?) at (.*?) to (.*?) at (.*?)(?: \((container)(?:: )?(.*?)\))?(?:;.*?)? \*\/$/
		) ?? []
	if (!match) return

	return {
		start: Length.parse(rawStart)!,
		startBP: Length.parse(rawStartBP)!,
		end: Length.parse(rawEnd)!,
		endBP: Length.parse(rawEndBP)!,
		container: (containerName as string | undefined) ?? Boolean(container),
		checkSC144: match.includes('WCAG SC 1.4.4')
	}
}

export const rewrite = (
	container: Container,
	context: Context,
	[startBP, endBP]: [Length | RawValue, Length | RawValue],
	atContainer?: string | true
) => {
	const contextKey = atContainer ? 'containers' : 'screens'
	endBP = (() => {
		if (typeof endBP !== 'string') return endBP
		// Check if it's [arbitrary] (i.e. from a modifier)
		if (/^\[(.*?)\]$/.test(endBP)) {
			return endBP.match(/^\[(.*?)\]$/)?.[1]
		} else {
			const bp = context[contextKey][endBP]
			if (!bp) error('bp-not-found', contextKey, endBP)
			return bp
		}
	})()

	// Walk through each `property: value` and rewrite any fluid expressions
	let foundExpr = false
	container.walkDecls((decl) => {
		const parsed = parse(decl.value)
		if (!parsed) return
		foundExpr = true

		decl.value = generate(parsed.start, parsed.end, context, {
			startBP,
			endBP,
			atContainer,
			checkSC144: parsed.checkSC144,
			checkBP: true
		})
	})
	// Prevent rules like ~md/lg:relative
	if (!foundExpr) error('no-utility')
}
