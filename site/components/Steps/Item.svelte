<li
	class="
        dark:before:highlight-white/5 not-last-of-type:pb-8 not-last-of-type:after:absolute not-last-of-type:after:top-[calc(1.875rem+1px)] not-last-of-type:after:bottom-0 not-last-of-type:after:left-[0.6875rem] not-last-of-type:after:w-px not-last-of-type:after:bg-slate-200 not-last-of-type:dark:after:bg-slate-200/5 relative my-0 grid-cols-5 gap-16 pl-10 before:absolute before:left-0 before:flex before:h-[calc(1.375rem+1px)] before:w-[calc(1.375rem+1px)] before:items-center before:justify-center before:rounded-md before:text-[0.625rem] before:font-bold before:text-slate-700 before:shadow-sm
        before:ring-1 before:ring-slate-900/5 before:content-[counter(step)] lg:grid dark:before:bg-slate-700 dark:before:text-slate-200 dark:before:shadow-none dark:before:ring-0
    "
	style:counter-increment="step"
>
	<div
		class="prose prose-sm prose-slate dark:prose-invert col-span-2 mb-6 mt-0 lg:mb-0 [&_p:has(strong:only-child)+p]:mt-0 [&_p:has(strong:only-child)]:mb-2"
	>
		<slot />
	</div>
	<div class="col-span-3 -ml-10 lg:ml-0 [&>:first-child]:mt-0 [&>:last-child]:mb-0">
		<slot name="code" />
	</div>
</li>
