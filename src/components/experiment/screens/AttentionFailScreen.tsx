"use client";

import { Button } from '@/components/ui/button';
import { ExternalLink, XCircle } from 'lucide-react';
import { PROLIFIC_CONFIG } from '@/lib/experiment-utils';

export function AttentionFailScreen() {
   const handleProlificRedirect = () => {
     window.location.href = PROLIFIC_CONFIG.COMPLETION_URL;
   };
 
   return (
     <div className="space-y-8 text-center">
       <div className="flex justify-center">
         <div className="bg-red-100 rounded-full p-4">
           <XCircle className="w-16 h-16 text-red-600" />
         </div>
       </div>
 
       <div className="space-y-4">
         <h1 className="text-3xl font-bold text-gray-900">
           You failed the attention checks
         </h1>
         <p className="text-lg text-gray-600 max-w-md mx-auto">
           You can return to Prolific using the button below.
         </p>
       </div>
 
       <div className="space-y-4">
         <Button
           onClick={handleProlificRedirect}
           className="bg-purple-600 hover:bg-purple-700 text-white"
         >
           Return to Prolific
           <ExternalLink className="w-4 h-4 ml-2" />
         </Button>
       </div>
     </div>
   );
 }
